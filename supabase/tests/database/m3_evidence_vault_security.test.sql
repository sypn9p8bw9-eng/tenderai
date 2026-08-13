begin;

create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email, email_confirmed_at)
values
  ('51000000-0000-0000-0000-000000000001', 'evidence-owner-a@example.test', now()),
  ('52000000-0000-0000-0000-000000000002', 'evidence-owner-b@example.test', now()),
  ('53000000-0000-0000-0000-000000000003', 'evidence-member-a@example.test', now()),
  ('54000000-0000-0000-0000-000000000004', 'evidence-viewer-a@example.test', now());

insert into public.profiles (id)
select id
from auth.users
where id in (
  '51000000-0000-0000-0000-000000000001',
  '52000000-0000-0000-0000-000000000002',
  '53000000-0000-0000-0000-000000000003',
  '54000000-0000-0000-0000-000000000004'
)
on conflict (id) do nothing;

insert into public.organizations (id, name, slug, created_by)
values
  ('e1000000-0000-0000-0000-000000000001', 'Evidence Organization A', 'evidence-organization-a', '51000000-0000-0000-0000-000000000001'),
  ('e2000000-0000-0000-0000-000000000002', 'Evidence Organization B', 'evidence-organization-b', '52000000-0000-0000-0000-000000000002');

insert into public.organization_members (organization_id, user_id, role)
values
  ('e1000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'owner'),
  ('e1000000-0000-0000-0000-000000000001', '53000000-0000-0000-0000-000000000003', 'member'),
  ('e1000000-0000-0000-0000-000000000001', '54000000-0000-0000-0000-000000000004', 'viewer'),
  ('e2000000-0000-0000-0000-000000000002', '52000000-0000-0000-0000-000000000002', 'owner');

insert into public.evidence_documents (
  id,
  organization_id,
  uploaded_by,
  title,
  category,
  file_name,
  file_path,
  mime_type,
  file_size_bytes
)
values
  (
    'd1000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001',
    '51000000-0000-0000-0000-000000000001',
    'Organization A evidence',
    'certification',
    'iso-9001.pdf',
    'e1000000-0000-0000-0000-000000000001/d1000000-0000-0000-0000-000000000001/iso-9001.pdf',
    'application/pdf',
    1024
  ),
  (
    'd2000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000002',
    '52000000-0000-0000-0000-000000000002',
    'Organization B evidence',
    'legal',
    'visura.pdf',
    'e2000000-0000-0000-0000-000000000002/d2000000-0000-0000-0000-000000000002/visura.pdf',
    'application/pdf',
    1024
  );

set local role authenticated;
set local request.jwt.claim.sub = '51000000-0000-0000-0000-000000000001';
set local request.jwt.claim.email = 'evidence-owner-a@example.test';
set local request.jwt.claim.role = 'authenticated';

select results_eq(
  $$select id from public.evidence_documents order by id$$,
  $$values ('d1000000-0000-0000-0000-000000000001'::uuid)$$,
  'an organization owner cannot read another tenant evidence document'
);

set local request.jwt.claim.sub = '53000000-0000-0000-0000-000000000003';
set local request.jwt.claim.email = 'evidence-member-a@example.test';

select lives_ok(
  $$insert into public.evidence_documents (
    id, organization_id, uploaded_by, title, category, file_name, file_path, mime_type, file_size_bytes
  ) values (
    'd3000000-0000-0000-0000-000000000003',
    'e1000000-0000-0000-0000-000000000001',
    '53000000-0000-0000-0000-000000000003',
    'Member evidence',
    'technical',
    'technical.pdf',
    'e1000000-0000-0000-0000-000000000001/d3000000-0000-0000-0000-000000000003/technical.pdf',
    'application/pdf',
    2048
  )$$,
  'a normal member can create evidence only for their organization and identity'
);

select throws_ok(
  $$update public.evidence_documents
    set status = 'archived'
    where id = 'd1000000-0000-0000-0000-000000000001'$$,
  '42501',
  'Only organization owners and admins may archive evidence documents.',
  'a normal member cannot archive evidence'
);

set local request.jwt.claim.sub = '54000000-0000-0000-0000-000000000004';
set local request.jwt.claim.email = 'evidence-viewer-a@example.test';

select throws_ok(
  $$insert into public.evidence_documents (
    id, organization_id, uploaded_by, title, category, file_name, file_path, mime_type, file_size_bytes
  ) values (
    'd4000000-0000-0000-0000-000000000004',
    'e1000000-0000-0000-0000-000000000001',
    '54000000-0000-0000-0000-000000000004',
    'Viewer evidence',
    'other',
    'viewer.pdf',
    'e1000000-0000-0000-0000-000000000001/d4000000-0000-0000-0000-000000000004/viewer.pdf',
    'application/pdf',
    1024
  )$$,
  '42501',
  'new row violates row-level security policy for table "evidence_documents"',
  'a viewer cannot create evidence'
);

select ok(
  (select private.has_evidence_storage_role(
    'evidence-documents',
    'e1000000-0000-0000-0000-000000000001/d1000000-0000-0000-0000-000000000001/iso-9001.pdf',
    array['owner', 'admin', 'member', 'viewer']::public.organization_role[]
  )),
  'a viewer can read storage objects in their organization path'
);

select ok(
  not (select private.has_evidence_storage_role(
    'evidence-documents',
    'e1000000-0000-0000-0000-000000000001/d1000000-0000-0000-0000-000000000001/iso-9001.pdf',
    array['owner', 'admin', 'member']::public.organization_role[]
  )),
  'a viewer cannot write storage objects'
);

set local request.jwt.claim.sub = '51000000-0000-0000-0000-000000000001';
set local request.jwt.claim.email = 'evidence-owner-a@example.test';

select ok(
  (select private.has_evidence_storage_role(
    'evidence-documents',
    'e1000000-0000-0000-0000-000000000001/d1000000-0000-0000-0000-000000000001/iso-9001.pdf',
    array['owner', 'admin', 'member']::public.organization_role[]
  )),
  'an authenticated owner can upload to the exact organization evidence path'
);

select ok(
  not (select private.has_evidence_storage_role(
    'evidence-documents',
    'e2000000-0000-0000-0000-000000000002/d2000000-0000-0000-0000-000000000002/visura.pdf',
    array['owner', 'admin', 'member', 'viewer']::public.organization_role[]
  )),
  'a user cannot access a different organization storage path'
);

select lives_ok(
  $$update public.evidence_documents
    set status = 'archived'
    where id = 'd1000000-0000-0000-0000-000000000001'$$,
  'an owner can archive evidence'
);

select is(
  (select status from public.evidence_documents where id = 'd1000000-0000-0000-0000-000000000001'),
  'archived'::public.evidence_document_status,
  'the archive status is persisted'
);

select * from finish();
rollback;
