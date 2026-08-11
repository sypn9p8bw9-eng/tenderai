begin;

create schema if not exists private;
revoke all on schema private from public;

create type public.organization_role as enum ('owner', 'admin', 'member', 'viewer');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length
    check (display_name is null or char_length(trim(display_name)) between 1 and 120)
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_name_length check (char_length(trim(name)) between 2 and 120),
  constraint organizations_slug_format
    check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) between 3 and 63)
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.organization_role not null,
  invited_by uuid references public.profiles (id) on delete set null,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organization_members_user_id_idx
  on public.organization_members (user_id, organization_id);

create index organization_members_organization_role_idx
  on public.organization_members (organization_id, role);

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null,
  role public.organization_role not null,
  token_hash bytea not null unique,
  status public.invitation_status not null default 'pending',
  invited_by uuid not null references public.profiles (id) on delete restrict,
  accepted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  constraint organization_invitations_email_normalized
    check (email = lower(trim(email)) and char_length(email) between 3 and 320 and position('@' in email) > 1),
  constraint organization_invitations_token_hash_length check (octet_length(token_hash) = 32),
  constraint organization_invitations_no_owner_role check (role <> 'owner'),
  constraint organization_invitations_expiration check (expires_at > created_at),
  constraint organization_invitations_state_consistency check (
    (status = 'pending' and accepted_at is null and accepted_by is null and revoked_at is null)
    or (status = 'accepted' and accepted_at is not null and accepted_by is not null and revoked_at is null)
    or (status = 'revoked' and accepted_at is null and accepted_by is null and revoked_at is not null)
  )
);

create unique index organization_invitations_pending_email_idx
  on public.organization_invitations (organization_id, lower(email))
  where status = 'pending';

create index organization_invitations_organization_status_idx
  on public.organization_invitations (organization_id, status, created_at desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function private.set_updated_at();

create trigger organization_members_set_updated_at
before update on public.organization_members
for each row execute function private.set_updated_at();

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

create or replace function private.is_organization_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.organization_members membership
      where membership.organization_id = p_organization_id
        and membership.user_id = (select auth.uid())
    );
$$;

create or replace function private.has_organization_role(
  p_organization_id uuid,
  p_roles public.organization_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.organization_members membership
      where membership.organization_id = p_organization_id
        and membership.user_id = (select auth.uid())
        and membership.role = any(p_roles)
    );
$$;

create or replace function private.shares_organization_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.organization_members current_membership
      join public.organization_members target_membership
        on target_membership.organization_id = current_membership.organization_id
      where current_membership.user_id = (select auth.uid())
        and target_membership.user_id = p_user_id
    );
$$;

revoke all on function private.is_organization_member(uuid) from public, anon;
revoke all on function private.has_organization_role(uuid, public.organization_role[]) from public, anon;
revoke all on function private.shares_organization_with(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_organization_member(uuid) to authenticated;
grant execute on function private.has_organization_role(uuid, public.organization_role[]) to authenticated;
grant execute on function private.shares_organization_with(uuid) to authenticated;

create or replace function private.protect_organization_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner' then
    if tg_op = 'DELETE' or (tg_op = 'UPDATE' and new.role <> 'owner') then
      perform 1
      from public.organizations
      where id = old.organization_id
      for update;

      -- A cascading organization deletion has already made the parent row
      -- invisible. Allow that cascade; normal membership mutations retain it.
      if not found and tg_op = 'DELETE' then
        return old;
      end if;

      if not exists (
        select 1
        from public.organization_members membership
        where membership.organization_id = old.organization_id
          and membership.user_id <> old.user_id
          and membership.role = 'owner'
      ) then
        raise exception using
          errcode = '23514',
          message = 'An organization must retain at least one owner.';
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function private.protect_organization_owner() from public, anon, authenticated;

create trigger organization_members_protect_owner
before update of role or delete on public.organization_members
for each row execute function private.protect_organization_owner();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.organization_invitations enable row level security;

create policy profiles_select_permitted
on public.profiles for select
to authenticated
using (
  id = (select auth.uid())
  or (select private.shares_organization_with(id))
);

create policy profiles_update_own
on public.profiles for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy organizations_select_member
on public.organizations for select
to authenticated
using ((select private.is_organization_member(id)));

create policy organization_members_select_member
on public.organization_members for select
to authenticated
using ((select private.is_organization_member(organization_id)));

create policy organization_invitations_select_manager
on public.organization_invitations for select
to authenticated
using (
  (select private.has_organization_role(
    organization_id,
    array['owner', 'admin']::public.organization_role[]
  ))
);

create or replace function public.create_organization(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_organization_id uuid;
  v_name text := trim(p_name);
  v_slug text := lower(trim(p_slug));
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if v_name is null or char_length(v_name) not between 2 and 120 then
    raise exception using errcode = '22023', message = 'Organization name is invalid.';
  end if;

  if v_slug is null or v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_slug) not between 3 and 63 then
    raise exception using errcode = '22023', message = 'Organization slug is invalid.';
  end if;

  insert into public.profiles (id)
  values (v_user_id)
  on conflict (id) do nothing;

  insert into public.organizations (name, slug, created_by)
  values (v_name, v_slug, v_user_id)
  returning id into v_organization_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (v_organization_id, v_user_id, 'owner');

  return v_organization_id;
end;
$$;

create or replace function public.invite_organization_member(
  p_organization_id uuid,
  p_email text,
  p_role public.organization_role,
  p_token_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_caller_role public.organization_role;
  v_email text := lower(trim(p_email));
  v_invitation_id uuid;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select role into v_caller_role
  from public.organization_members
  where organization_id = p_organization_id and user_id = v_user_id
  for share;

  if v_caller_role is null or v_caller_role not in ('owner', 'admin') then
    raise exception using errcode = '42501', message = 'Only organization owners and admins may invite members.';
  end if;

  if p_role is null or p_role = 'owner' or (v_caller_role = 'admin' and p_role not in ('member', 'viewer')) then
    raise exception using errcode = '42501', message = 'You cannot assign the requested role.';
  end if;

  if v_email is null or char_length(v_email) not between 3 and 320 or position('@' in v_email) <= 1 then
    raise exception using errcode = '22023', message = 'Invitation email is invalid.';
  end if;

  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invitation token hash is invalid.';
  end if;

  if exists (
    select 1
    from public.organization_members membership
    join auth.users account on account.id = membership.user_id
    where membership.organization_id = p_organization_id
      and lower(account.email) = v_email
  ) then
    raise exception using errcode = '23505', message = 'This user is already an organization member.';
  end if;

  update public.organization_invitations
  set status = 'revoked', revoked_at = now()
  where organization_id = p_organization_id
    and email = v_email
    and status = 'pending'
    and expires_at <= now();

  insert into public.organization_invitations (
    organization_id,
    email,
    role,
    token_hash,
    invited_by
  )
  values (
    p_organization_id,
    v_email,
    p_role,
    decode(p_token_hash, 'hex'),
    v_user_id
  )
  returning id into v_invitation_id;

  return v_invitation_id;
end;
$$;

create or replace function public.accept_organization_invitation(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_user_email text;
  v_invitation public.organization_invitations%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'Invitation token is invalid.';
  end if;

  select lower(email) into v_user_email
  from auth.users
  where id = v_user_id and email_confirmed_at is not null;

  if v_user_email is null then
    raise exception using errcode = '42501', message = 'A verified email address is required.';
  end if;

  select * into v_invitation
  from public.organization_invitations
  where token_hash = decode(p_token_hash, 'hex')
  for update;

  if not found
    or v_invitation.status <> 'pending'
    or v_invitation.expires_at <= now()
    or v_invitation.email <> v_user_email then
    raise exception using errcode = '28000', message = 'Invitation is invalid, expired, or intended for another account.';
  end if;

  if exists (
    select 1
    from public.organization_members
    where organization_id = v_invitation.organization_id and user_id = v_user_id
  ) then
    raise exception using errcode = '23505', message = 'You are already an organization member.';
  end if;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    invited_by
  )
  values (
    v_invitation.organization_id,
    v_user_id,
    v_invitation.role,
    v_invitation.invited_by
  );

  update public.organization_invitations
  set status = 'accepted', accepted_by = v_user_id, accepted_at = now()
  where id = v_invitation.id;

  return v_invitation.organization_id;
end;
$$;

create or replace function public.revoke_organization_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_organization_id uuid;
  v_caller_role public.organization_role;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select organization_id into v_organization_id
  from public.organization_invitations
  where id = p_invitation_id and status = 'pending'
  for update;

  select role into v_caller_role
  from public.organization_members
  where organization_id = v_organization_id and user_id = v_user_id
  for share;

  if v_organization_id is null or v_caller_role is null or v_caller_role not in ('owner', 'admin') then
    raise exception using errcode = '42501', message = 'Invitation not found or not revocable.';
  end if;

  update public.organization_invitations
  set status = 'revoked', revoked_at = now()
  where id = p_invitation_id and status = 'pending';
end;
$$;

create or replace function public.update_organization_member_role(
  p_organization_id uuid,
  p_user_id uuid,
  p_role public.organization_role
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_caller_role public.organization_role;
  v_target_role public.organization_role;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select role into v_caller_role
  from public.organization_members
  where organization_id = p_organization_id and user_id = v_user_id
  for share;

  select role into v_target_role
  from public.organization_members
  where organization_id = p_organization_id and user_id = p_user_id
  for update;

  if v_target_role is null then
    raise exception using errcode = 'P0002', message = 'Organization member not found.';
  end if;

  if v_target_role = 'owner' or p_role = 'owner' then
    raise exception using errcode = '42501', message = 'Owner changes require a dedicated ownership transfer flow.';
  end if;

  if v_caller_role = 'owner' then
    null;
  elsif v_caller_role = 'admin'
    and v_target_role in ('member', 'viewer')
    and p_role in ('member', 'viewer') then
    null;
  else
    raise exception using errcode = '42501', message = 'You cannot change this membership role.';
  end if;

  update public.organization_members
  set role = p_role
  where organization_id = p_organization_id and user_id = p_user_id;
end;
$$;

create or replace function public.remove_organization_member(
  p_organization_id uuid,
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_caller_role public.organization_role;
  v_target_role public.organization_role;
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select role into v_caller_role
  from public.organization_members
  where organization_id = p_organization_id and user_id = v_user_id
  for share;

  select role into v_target_role
  from public.organization_members
  where organization_id = p_organization_id and user_id = p_user_id
  for update;

  if v_target_role is null then
    raise exception using errcode = 'P0002', message = 'Organization member not found.';
  end if;

  if v_target_role = 'owner' then
    raise exception using errcode = '42501', message = 'Owners cannot be removed without an ownership transfer.';
  end if;

  if v_caller_role = 'owner' then
    null;
  elsif v_caller_role = 'admin' and v_target_role in ('member', 'viewer') then
    null;
  else
    raise exception using errcode = '42501', message = 'You cannot remove this organization member.';
  end if;

  delete from public.organization_members
  where organization_id = p_organization_id and user_id = p_user_id;
end;
$$;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.organizations from anon, authenticated;
revoke all on table public.organization_members from anon, authenticated;
revoke all on table public.organization_invitations from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.organizations to authenticated;
grant select on public.organization_members to authenticated;
grant select on public.organization_invitations to authenticated;
grant usage on type public.organization_role, public.invitation_status to authenticated;

revoke all on function public.create_organization(text, text) from public, anon, authenticated;
revoke all on function public.invite_organization_member(uuid, text, public.organization_role, text) from public, anon, authenticated;
revoke all on function public.accept_organization_invitation(text) from public, anon, authenticated;
revoke all on function public.revoke_organization_invitation(uuid) from public, anon, authenticated;
revoke all on function public.update_organization_member_role(uuid, uuid, public.organization_role) from public, anon, authenticated;
revoke all on function public.remove_organization_member(uuid, uuid) from public, anon, authenticated;

grant execute on function public.create_organization(text, text) to authenticated;
grant execute on function public.invite_organization_member(uuid, text, public.organization_role, text) to authenticated;
grant execute on function public.accept_organization_invitation(text) to authenticated;
grant execute on function public.revoke_organization_invitation(uuid) to authenticated;
grant execute on function public.update_organization_member_role(uuid, uuid, public.organization_role) to authenticated;
grant execute on function public.remove_organization_member(uuid, uuid) to authenticated;

comment on schema private is 'Non-exposed helpers used by RLS policies and triggers.';
comment on function private.is_organization_member(uuid) is
  'SECURITY DEFINER avoids recursive organization_members RLS. Identity always comes from auth.uid().';
comment on function private.has_organization_role(uuid, public.organization_role[]) is
  'SECURITY DEFINER avoids recursive role checks. Identity always comes from auth.uid().';
comment on column public.organization_invitations.token_hash is
  'SHA-256 hash of a one-time invitation token. Raw invitation tokens are never persisted.';

commit;
