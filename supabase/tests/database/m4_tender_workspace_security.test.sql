begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, email_confirmed_at)
values
  ('61000000-0000-0000-0000-000000000001', 'tender-owner-a@example.test', now()),
  ('62000000-0000-0000-0000-000000000002', 'tender-owner-b@example.test', now()),
  ('63000000-0000-0000-0000-000000000003', 'tender-member-a@example.test', now()),
  ('64000000-0000-0000-0000-000000000004', 'tender-viewer-a@example.test', now());

insert into public.profiles (id)
select id
from auth.users
where id in (
  '61000000-0000-0000-0000-000000000001',
  '62000000-0000-0000-0000-000000000002',
  '63000000-0000-0000-0000-000000000003',
  '64000000-0000-0000-0000-000000000004'
)
on conflict (id) do nothing;

insert into public.organizations (id, name, slug, created_by)
values
  ('f1000000-0000-0000-0000-000000000001', 'Tender Organization A', 'tender-organization-a', '61000000-0000-0000-0000-000000000001'),
  ('f2000000-0000-0000-0000-000000000002', 'Tender Organization B', 'tender-organization-b', '62000000-0000-0000-0000-000000000002');

insert into public.organization_members (organization_id, user_id, role)
values
  ('f1000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', 'owner'),
  ('f1000000-0000-0000-0000-000000000001', '63000000-0000-0000-0000-000000000003', 'member'),
  ('f1000000-0000-0000-0000-000000000001', '64000000-0000-0000-0000-000000000004', 'viewer'),
  ('f2000000-0000-0000-0000-000000000002', '62000000-0000-0000-0000-000000000002', 'owner');

insert into public.tenders (id, organization_id, created_by, title, status)
values
  ('a1000000-0000-0000-0000-000000000001', 'f1000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', 'Organization A tender', 'draft'),
  ('a2000000-0000-0000-0000-000000000002', 'f2000000-0000-0000-0000-000000000002', '62000000-0000-0000-0000-000000000002', 'Organization B tender', 'draft');

select throws_ok(
  $$insert into public.tender_documents (
    id, organization_id, tender_id, uploaded_by, title, file_name, file_path, mime_type, file_size_bytes
  ) values (
    'b1000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000001',
    'a2000000-0000-0000-0000-000000000002',
    '61000000-0000-0000-0000-000000000001',
    'Cross-tenant document',
    'source.pdf',
    'f1000000-0000-0000-0000-000000000001/a2000000-0000-0000-0000-000000000002/b1000000-0000-0000-0000-000000000001/source.pdf',
    'application/pdf',
    1024
  )$$,
  '23503',
  'insert or update on table "tender_documents" violates foreign key constraint "tender_documents_tender_organization_fkey"',
  'a tender document cannot reference a tender from another organization'
);

set local role authenticated;
set local request.jwt.claim.sub = '61000000-0000-0000-0000-000000000001';
set local request.jwt.claim.email = 'tender-owner-a@example.test';
set local request.jwt.claim.role = 'authenticated';

select results_eq(
  $$select id from public.tenders order by id$$,
  $$values ('a1000000-0000-0000-0000-000000000001'::uuid)$$,
  'an organization owner cannot read another tenant tender'
);

select ok(
  (select private.has_tender_document_storage_role(
    'tender-documents',
    'f1000000-0000-0000-0000-000000000001/a1000000-0000-0000-0000-000000000001/b2000000-0000-0000-0000-000000000002/bando.pdf',
    array['owner', 'admin', 'member']::public.organization_role[]
  )),
  'an authenticated owner can upload to an existing tender path in their organization'
);

select ok(
  not (select private.has_tender_document_storage_role(
    'tender-documents',
    'f2000000-0000-0000-0000-000000000002/a2000000-0000-0000-0000-000000000002/b2000000-0000-0000-0000-000000000002/bando.pdf',
    array['owner', 'admin', 'member']::public.organization_role[]
  )),
  'a user cannot access a different organization tender storage path'
);

select ok(
  not (select private.has_tender_document_storage_role(
    'evidence-documents',
    'f1000000-0000-0000-0000-000000000001/a1000000-0000-0000-0000-000000000001/b2000000-0000-0000-0000-000000000002/bando.pdf',
    array['owner', 'admin', 'member']::public.organization_role[]
  )),
  'a tender storage helper rejects a different bucket'
);

set local request.jwt.claim.sub = '63000000-0000-0000-0000-000000000003';
set local request.jwt.claim.email = 'tender-member-a@example.test';

select lives_ok(
  $$insert into public.tenders (id, organization_id, created_by, title)
  values (
    'a3000000-0000-0000-0000-000000000003',
    'f1000000-0000-0000-0000-000000000001',
    '63000000-0000-0000-0000-000000000003',
    'Member tender'
  )$$,
  'a member can create a tender in their organization'
);

select lives_ok(
  $$insert into public.tender_documents (
    id, organization_id, tender_id, uploaded_by, title, file_name, file_path, mime_type, file_size_bytes
  ) values (
    'b3000000-0000-0000-0000-000000000003',
    'f1000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    '63000000-0000-0000-0000-000000000003',
    'Member source document',
    'disciplinare.pdf',
    'f1000000-0000-0000-0000-000000000001/a1000000-0000-0000-0000-000000000001/b3000000-0000-0000-0000-000000000003/disciplinare.pdf',
    'application/pdf',
    2048
  )$$,
  'a member can add a document to an active tender in their organization'
);

select throws_ok(
  $$update public.tenders
    set status = 'archived'
    where id = 'a1000000-0000-0000-0000-000000000001'$$,
  '42501',
  'Only organization owners and admins may archive tenders.',
  'a member cannot archive a tender'
);

set local request.jwt.claim.sub = '64000000-0000-0000-0000-000000000004';
set local request.jwt.claim.email = 'tender-viewer-a@example.test';

update public.tenders
set title = 'Viewer mutation attempt'
where id = 'a1000000-0000-0000-0000-000000000001';

select is(
  (select title from public.tenders where id = 'a1000000-0000-0000-0000-000000000001'),
  'Organization A tender',
  'a viewer cannot update tender metadata'
);

select throws_ok(
  $$insert into public.tenders (id, organization_id, created_by, title)
  values (
    'a4000000-0000-0000-0000-000000000004',
    'f1000000-0000-0000-0000-000000000001',
    '64000000-0000-0000-0000-000000000004',
    'Viewer tender'
  )$$,
  '42501',
  'new row violates row-level security policy for table "tenders"',
  'a viewer cannot create a tender'
);

select ok(
  not (select private.has_tender_document_storage_role(
    'tender-documents',
    'f1000000-0000-0000-0000-000000000001/a1000000-0000-0000-0000-000000000001/b4000000-0000-0000-0000-000000000004/bando.pdf',
    array['owner', 'admin', 'member']::public.organization_role[]
  )),
  'a viewer cannot upload to a tender storage path'
);

set local request.jwt.claim.sub = '61000000-0000-0000-0000-000000000001';
set local request.jwt.claim.email = 'tender-owner-a@example.test';

select lives_ok(
  $$update public.tenders
    set status = 'archived'
    where id = 'a1000000-0000-0000-0000-000000000001'$$,
  'an owner can archive a tender'
);

select is(
  (select status from public.tenders where id = 'a1000000-0000-0000-0000-000000000001'),
  'archived'::public.tender_status,
  'the archive status is persisted'
);

select throws_ok(
  $$insert into public.tender_documents (
    id, organization_id, tender_id, uploaded_by, title, file_name, file_path, mime_type, file_size_bytes
  ) values (
    'b4000000-0000-0000-0000-000000000004',
    'f1000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001',
    '61000000-0000-0000-0000-000000000001',
    'Archived tender document',
    'archived.pdf',
    'f1000000-0000-0000-0000-000000000001/a1000000-0000-0000-0000-000000000001/b4000000-0000-0000-0000-000000000004/archived.pdf',
    'application/pdf',
    1024
  )$$,
  '42501',
  'new row violates row-level security policy for table "tender_documents"',
  'an archived tender cannot receive new document metadata'
);

select * from finish();
rollback;
