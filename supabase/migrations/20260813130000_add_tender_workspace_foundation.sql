begin;

create type public.tender_status as enum (
  'draft',
  'evaluating',
  'in_progress',
  'submitted',
  'won',
  'lost',
  'archived'
);

create type public.tender_procedure_type as enum (
  'open',
  'restricted',
  'negotiated',
  'direct_award',
  'framework',
  'other'
);

create type public.tender_document_type as enum (
  'bando',
  'disciplinare',
  'capitolato',
  'allegato',
  'chiarimento',
  'modello',
  'other'
);

create table public.tenders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  title text not null,
  description text,
  status public.tender_status not null default 'draft',
  procedure_type public.tender_procedure_type,
  buyer_name text,
  cig text,
  cup text,
  estimated_value numeric(14, 2),
  currency text not null default 'EUR',
  submission_deadline timestamptz,
  source_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint tenders_title_length
    check (char_length(trim(title)) between 2 and 200),
  constraint tenders_description_length
    check (description is null or char_length(trim(description)) between 1 and 4000),
  constraint tenders_buyer_name_length
    check (buyer_name is null or char_length(trim(buyer_name)) between 1 and 200),
  constraint tenders_cig_length
    check (cig is null or char_length(trim(cig)) between 1 and 40),
  constraint tenders_cup_length
    check (cup is null or char_length(trim(cup)) between 1 and 40),
  constraint tenders_currency_format
    check (currency ~ '^[A-Z]{3}$'),
  constraint tenders_estimated_value_range
    check (estimated_value is null or estimated_value >= 0),
  constraint tenders_source_url_format
    check (
      source_url is null
      or (
        char_length(source_url) <= 2048
        and source_url ~* '^https?://[^[:space:]]+$'
      )
    ),
  constraint tenders_notes_length
    check (notes is null or char_length(trim(notes)) between 1 and 5000),
  constraint tenders_archival_state
    check ((status = 'archived') = (archived_at is not null)),
  constraint tenders_id_organization_unique unique (id, organization_id)
);

create index tenders_organization_created_at_idx
  on public.tenders (organization_id, created_at desc);

create index tenders_organization_status_idx
  on public.tenders (organization_id, status);

create index tenders_organization_submission_deadline_idx
  on public.tenders (organization_id, submission_deadline);

create index tenders_created_by_idx
  on public.tenders (created_by);

create table public.tender_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  tender_id uuid not null,
  uploaded_by uuid references public.profiles (id) on delete set null,
  document_type public.tender_document_type not null default 'other',
  title text not null,
  file_name text not null,
  file_path text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  created_at timestamptz not null default now(),
  constraint tender_documents_tender_organization_fkey
    foreign key (tender_id, organization_id)
    references public.tenders (id, organization_id)
    on delete cascade,
  constraint tender_documents_title_length
    check (char_length(trim(title)) between 2 and 200),
  constraint tender_documents_file_name_format
    check (file_name ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,179}$'),
  constraint tender_documents_file_path_length
    check (char_length(file_path) between 112 and 400),
  constraint tender_documents_file_path_scope
    check (
      file_path = organization_id::text
        || '/' || tender_id::text
        || '/' || id::text
        || '/' || file_name
    ),
  constraint tender_documents_mime_type_length
    check (char_length(mime_type) between 3 and 150),
  constraint tender_documents_mime_type_allowed
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
  constraint tender_documents_file_size_range
    check (file_size_bytes between 1 and 26214400)
);

create index tender_documents_organization_tender_created_at_idx
  on public.tender_documents (organization_id, tender_id, created_at desc);

create index tender_documents_tender_organization_idx
  on public.tender_documents (tender_id, organization_id);

create index tender_documents_uploaded_by_idx
  on public.tender_documents (uploaded_by);

create trigger tenders_set_updated_at
before update on public.tenders
for each row execute function private.set_updated_at();

create or replace function private.protect_tender_integrity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.organization_id is distinct from old.organization_id
    or new.created_by is distinct from old.created_by then
    raise exception using
      errcode = '42501',
      message = 'Tender tenant and creator identity are immutable.';
  end if;

  if old.status = 'archived' then
    raise exception using
      errcode = '42501',
      message = 'Archived tenders cannot be modified.';
  end if;

  if new.status = 'archived' then
    if not (select private.has_organization_role(
      old.organization_id,
      array['owner', 'admin']::public.organization_role[]
    )) then
      raise exception using
        errcode = '42501',
        message = 'Only organization owners and admins may archive tenders.';
    end if;

    new.archived_at := now();
  else
    new.archived_at := null;
  end if;

  return new;
end;
$$;

revoke all on function private.protect_tender_integrity()
from public, anon, authenticated;

create trigger tenders_protect_integrity
before update on public.tenders
for each row execute function private.protect_tender_integrity();

alter table public.tenders enable row level security;
alter table public.tender_documents enable row level security;

create policy tenders_select_member
on public.tenders for select
to authenticated
using ((select private.is_organization_member(organization_id)));

create policy tenders_insert_contributor
on public.tenders for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and status <> 'archived'
  and archived_at is null
  and (select private.has_organization_role(
    organization_id,
    array['owner', 'admin', 'member']::public.organization_role[]
  ))
);

create policy tenders_update_contributor
on public.tenders for update
to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['owner', 'admin', 'member']::public.organization_role[]
)))
with check ((select private.has_organization_role(
  organization_id,
  array['owner', 'admin', 'member']::public.organization_role[]
)));

create policy tenders_delete_manager
on public.tenders for delete
to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['owner', 'admin']::public.organization_role[]
)));

create policy tender_documents_select_member
on public.tender_documents for select
to authenticated
using ((select private.is_organization_member(organization_id)));

create policy tender_documents_insert_contributor
on public.tender_documents for insert
to authenticated
with check (
  uploaded_by = (select auth.uid())
  and (select private.has_organization_role(
    organization_id,
    array['owner', 'admin', 'member']::public.organization_role[]
  ))
  and exists (
    select 1
    from public.tenders tender
    where tender.id = tender_documents.tender_id
      and tender.organization_id = tender_documents.organization_id
      and tender.status <> 'archived'
  )
);

create policy tender_documents_delete_manager
on public.tender_documents for delete
to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['owner', 'admin']::public.organization_role[]
)));

revoke all on table public.tenders, public.tender_documents from anon, authenticated;
grant select, insert, update, delete on table public.tenders to authenticated;
grant select, insert, delete on table public.tender_documents to authenticated;
grant usage on type public.tender_status, public.tender_procedure_type, public.tender_document_type to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'tender-documents',
  'tender-documents',
  false,
  26214400,
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

create or replace function private.has_tender_document_storage_role(
  p_bucket_id text,
  p_object_name text,
  p_roles public.organization_role[]
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when p_bucket_id = 'tender-documents'
      and p_object_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9][A-Za-z0-9._-]{0,179}$'
      and exists (
        select 1
        from public.tenders tender
        where tender.id = split_part(p_object_name, '/', 2)::uuid
          and tender.organization_id = split_part(p_object_name, '/', 1)::uuid
      )
    then private.has_organization_role(
      split_part(p_object_name, '/', 1)::uuid,
      p_roles
    )
    else false
  end;
$$;

revoke all on function private.has_tender_document_storage_role(
  text,
  text,
  public.organization_role[]
) from public, anon;
grant execute on function private.has_tender_document_storage_role(
  text,
  text,
  public.organization_role[]
) to authenticated;

create policy tender_storage_objects_select_member
on storage.objects for select
to authenticated
using ((select private.has_tender_document_storage_role(
  bucket_id,
  name,
  array['owner', 'admin', 'member', 'viewer']::public.organization_role[]
)));

create policy tender_storage_objects_insert_contributor
on storage.objects for insert
to authenticated
with check (
  (select private.has_tender_document_storage_role(
    bucket_id,
    name,
    array['owner', 'admin', 'member']::public.organization_role[]
  ))
  and exists (
    select 1
    from public.tenders tender
    where tender.id = split_part(storage.objects.name, '/', 2)::uuid
      and tender.organization_id = split_part(storage.objects.name, '/', 1)::uuid
      and tender.status <> 'archived'
  )
);

create policy tender_storage_objects_delete_manager
on storage.objects for delete
to authenticated
using ((select private.has_tender_document_storage_role(
  bucket_id,
  name,
  array['owner', 'admin']::public.organization_role[]
)));

comment on table public.tenders is
  'Organization-owned public tender opportunities. Analysis and compliance conclusions are intentionally not represented here.';
comment on table public.tender_documents is
  'Immutable organization and tender-scoped source documents for a tender workspace.';
comment on column public.tender_documents.file_path is
  'Immutable private Storage path: organization_id/tender_id/document_id/safe_file_name.';
comment on function private.has_tender_document_storage_role(text, text, public.organization_role[]) is
  'Security-invoker Storage path and tender ownership validation that delegates membership authorization to private.has_organization_role.';

commit;
