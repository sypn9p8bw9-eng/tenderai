begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email, email_confirmed_at)
values
  ('10000000-0000-0000-0000-000000000001', 'owner-a@example.test', now()),
  ('20000000-0000-0000-0000-000000000002', 'owner-b@example.test', now()),
  ('30000000-0000-0000-0000-000000000003', 'member-a@example.test', now()),
  ('40000000-0000-0000-0000-000000000004', 'invitee-a@example.test', now());

insert into public.organizations (id, name, slug, created_by)
values
  ('a0000000-0000-0000-0000-000000000001', 'Organization A', 'organization-a', '10000000-0000-0000-0000-000000000001'),
  ('b0000000-0000-0000-0000-000000000002', 'Organization B', 'organization-b', '20000000-0000-0000-0000-000000000002');

insert into public.organization_members (organization_id, user_id, role)
values
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner'),
  ('a0000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'member'),
  ('b0000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'owner');

set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
set local request.jwt.claim.email = 'owner-a@example.test';
set local request.jwt.claim.role = 'authenticated';

select results_eq(
  $$select id from public.organizations order by id$$,
  $$values ('a0000000-0000-0000-0000-000000000001'::uuid)$$,
  'an owner cannot read another tenant organization'
);

select is(
  (select count(*) from public.organization_members where organization_id = 'b0000000-0000-0000-0000-000000000002'),
  0::bigint,
  'an owner cannot read another tenant membership list'
);

set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000003';
set local request.jwt.claim.email = 'member-a@example.test';

select throws_ok(
  $$select public.update_organization_member_role(
    'a0000000-0000-0000-0000-000000000001',
    '30000000-0000-0000-0000-000000000003',
    'admin'
  )$$,
  '42501',
  'You cannot change this membership role.',
  'a normal member cannot promote themselves'
);

select throws_ok(
  $$select public.invite_organization_member(
    'a0000000-0000-0000-0000-000000000001',
    'attacker@example.test',
    'member',
    repeat('cd', 32)
  )$$,
  '42501',
  'Only organization owners and admins may invite members.',
  'a normal member cannot create invitations'
);

select throws_ok(
  $$update public.organization_members
    set role = 'admin'
    where organization_id = 'a0000000-0000-0000-0000-000000000001'
      and user_id = '30000000-0000-0000-0000-000000000003'$$,
  '42501',
  'permission denied for table organization_members',
  'direct membership mutation is denied'
);

set local request.jwt.claim.sub = '10000000-0000-0000-0000-000000000001';
set local request.jwt.claim.email = 'owner-a@example.test';

select throws_ok(
  $$select public.update_organization_member_role(
    'a0000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'admin'
  )$$,
  '42501',
  'Owner changes require a dedicated ownership transfer flow.',
  'the owner cannot accidentally remove the only owner role'
);

select lives_ok(
  $$select public.invite_organization_member(
    'a0000000-0000-0000-0000-000000000001',
    'invitee-a@example.test',
    'member',
    repeat('ab', 32)
  )$$,
  'an owner can create an email-bound invitation'
);

set local request.jwt.claim.sub = '30000000-0000-0000-0000-000000000003';
set local request.jwt.claim.email = 'member-a@example.test';

select throws_ok(
  $$select public.accept_organization_invitation(repeat('ab', 32))$$,
  '28000',
  'Invitation is invalid, expired, or intended for another account.',
  'an invitation cannot be accepted by another email'
);

set local request.jwt.claim.sub = '40000000-0000-0000-0000-000000000004';
set local request.jwt.claim.email = 'invitee-a@example.test';

select results_eq(
  $$select public.accept_organization_invitation(repeat('ab', 32))$$,
  $$values ('a0000000-0000-0000-0000-000000000001'::uuid)$$,
  'acceptance joins only the organization bound to the token'
);

select is(
  (select role from public.organization_members
   where organization_id = 'a0000000-0000-0000-0000-000000000001'
     and user_id = '40000000-0000-0000-0000-000000000004'),
  'member'::public.organization_role,
  'the invited role is applied to the new membership'
);

select throws_ok(
  $$select public.accept_organization_invitation(repeat('ab', 32))$$,
  '28000',
  'Invitation is invalid, expired, or intended for another account.',
  'an invitation token cannot be reused'
);

select is(
  (select count(*) from public.organizations where id = 'b0000000-0000-0000-0000-000000000002'),
  0::bigint,
  'an invited member still cannot access a different tenant'
);

reset role;
set local role anon;

select throws_ok(
  $$select count(*) from public.organizations$$,
  '42501',
  'permission denied for table organizations',
  'unauthenticated users have no organization table access'
);

select * from finish();
rollback;
