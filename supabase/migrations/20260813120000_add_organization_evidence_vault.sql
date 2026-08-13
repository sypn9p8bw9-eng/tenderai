begin;

create type public.evidence_document_category as enum (
  'legal',
  'certification',
  'soa',
  'financial',
  'insurance',
  'administrative',
  'reference',
  'personnel',
  'equipment',
  'technical',
  'other'
);

create type public.evidence_document_status as enum (
  'active',
  'expired',
  'expiring_soon',
  'needs_review',
  'archived'
);

create table public.evidence_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  uploaded_by uuid references public.profiles (id) on delete set null,
  title text not null,
  description text,
  category public.evidence_document_category not null,
  status public.evidence_document_status not null default 'active',
  file_name text not null,
  file_path text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  issued_at date,
  expires_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint evidence_documents_title_length
    check (char_length(trim(title)) between 2 and 160),
  constraint evidence_documents_description_length
    check (description is null or char_length(trim(description)) between 1 and 2000),
  constraint evidence_documents_file_name_format
    check (file_name ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,179}$'),
  constraint evidence_documents_file_path_length
    check (char_length(file_path) between 75 and 255),
  constraint evidence_documents_file_path_organization_scope
    check (file_path = organization_id::text || '/' || id::text || '/' || file_name),
  constraint evidence_documents_mime_type_length
    check (char_length(mime_type) between 3 and 150),
  constraint evidence_documents_mime_type_allowed
    check (mime_type in (
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
      'image/webp'
    )),
  constraint evidence_documents_file_size_range
    check (file_size_bytes between 1 and 10485760),
  constraint evidence_documents_expiration_after_issue
    check (expires_at is null or issued_at is null or expires_at >= issued_at)
);

create index evidence_documents_organization_created_at_idx
  on public.evidence_documents (organization_id, created_at desc);

create index evidence_documents_organization_category_idx
  on public.evidence_documents (organization_id, category);

create index evidence_documents_organization_status_idx
  on public.evidence_documents (organization_id, status);

create index evidence_documents_uploaded_by_idx
  on public.evidence_documents (uploaded_by);

create trigger evidence_documents_set_updated_at
before update on public.evidence_documents
for each row execute function private.set_updated_at();

create or replace function private.protect_evidence_document_integrity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id
    or new.uploaded_by is distinct from old.uploaded_by
    or new.file_name is distinct from old.file_name
    or new.file_path is distinct from old.file_path
    or new.mime_type is distinct from old.mime_type
    or new.file_size_bytes is distinct from old.file_size_bytes then
    raise exception using
      errcode = '42501',
      message = 'Evidence document tenant and file identity are immutable.';
  end if;

  if (old.status = 'archived' or new.status = 'archived')
    and not (select private.has_organization_role(
      old.organization_id,
      array['owner', 'admin']::public.organization_role[]
    )) then
    raise exception using
      errcode = '42501',
      message = 'Only organization owners and admins may archive evidence documents.';
  end if;

  return new;
end;
$$;

revoke all on function private.protect_evidence_document_integrity()
from public, anon, authenticated;

create trigger evidence_documents_protect_integrity
before update on public.evidence_documents
for each row execute function private.protect_evidence_document_integrity();

alter table public.evidence_documents enable row level security;

create policy evidence_documents_select_member
on public.evidence_documents for select
to authenticated
using ((select private.is_organization_member(organization_id)));

create policy evidence_documents_insert_contributor
on public.evidence_documents for insert
to authenticated
with check (
  uploaded_by = (select auth.uid())
  and (select private.has_organization_role(
    organization_id,
    array['owner', 'admin', 'member']::public.organization_role[]
  ))
);

create policy evidence_documents_update_contributor
on public.evidence_documents for update
to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['owner', 'admin', 'member']::public.organization_role[]
)))
with check ((select private.has_organization_role(
  organization_id,
  array['owner', 'admin', 'member']::public.organization_role[]
)));

create policy evidence_documents_delete_manager
on public.evidence_documents for delete
to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['owner', 'admin']::public.organization_role[]
)));

revoke all on table public.evidence_documents from anon, authenticated;
grant select, insert, update, delete on table public.evidence_documents to authenticated;
grant usage on type public.evidence_document_category, public.evidence_document_status to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidence-documents',
  'evidence-documents',
  false,
  10485760,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.has_evidence_storage_role(
  p_bucket_id text,
  p_object_name text,
  p_roles public.organization_role[]
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
begin
  if p_bucket_id <> 'evidence-documents'
    or p_object_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9][A-Za-z0-9._-]{0,179}$' then
    return false;
  end if;

  v_organization_id := split_part(p_object_name, '/', 1)::uuid;

  return (select private.has_organization_role(v_organization_id, p_roles));
end;
$$;

revoke all on function private.has_evidence_storage_role(
  text,
  text,
  public.organization_role[]
) from public, anon;
grant execute on function private.has_evidence_storage_role(
  text,
  text,
  public.organization_role[]
) to authenticated;

create policy evidence_storage_objects_select_member
on storage.objects for select
to authenticated
using ((select private.has_evidence_storage_role(
  bucket_id,
  name,
  array['owner', 'admin', 'member', 'viewer']::public.organization_role[]
)));

create policy evidence_storage_objects_insert_contributor
on storage.objects for insert
to authenticated
with check ((select private.has_evidence_storage_role(
  bucket_id,
  name,
  array['owner', 'admin', 'member']::public.organization_role[]
)));

create policy evidence_storage_objects_delete_manager
on storage.objects for delete
to authenticated
using ((select private.has_evidence_storage_role(
  bucket_id,
  name,
  array['owner', 'admin']::public.organization_role[]
)));

comment on table public.evidence_documents is
  'Reusable organization-owned company evidence for future tender requirement matching.';
comment on column public.evidence_documents.file_path is
  'Immutable private Storage path: organization_id/document_id/safe_file_name.';
comment on function private.has_evidence_storage_role(text, text, public.organization_role[]) is
  'Validates the private evidence bucket path and checks the caller membership without exposing cross-tenant storage objects.';

commit;
