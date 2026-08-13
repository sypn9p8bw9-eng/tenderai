begin;

-- The path validator does not need elevated table access. Keeping this wrapper
-- as SECURITY INVOKER preserves the authenticated JWT context when it delegates
-- the membership lookup to the existing narrow SECURITY DEFINER helper.
create or replace function private.has_evidence_storage_role(
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
    when p_bucket_id = 'evidence-documents'
      and p_object_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9][A-Za-z0-9._-]{0,179}$'
    then private.has_organization_role(
      split_part(p_object_name, '/', 1)::uuid,
      p_roles
    )
    else false
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

comment on function private.has_evidence_storage_role(text, text, public.organization_role[]) is
  'Security-invoker path validation that delegates organization membership authorization to private.has_organization_role while preserving auth.uid().';

commit;
