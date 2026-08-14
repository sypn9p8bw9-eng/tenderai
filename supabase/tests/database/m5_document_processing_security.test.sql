begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email, email_confirmed_at)
values
  ('71000000-0000-0000-0000-000000000001', 'processing-owner-a@example.test', now()),
  ('72000000-0000-0000-0000-000000000002', 'processing-owner-b@example.test', now()),
  ('73000000-0000-0000-0000-000000000003', 'processing-viewer-a@example.test', now());

insert into public.profiles (id)
select id
from auth.users
where id in (
  '71000000-0000-0000-0000-000000000001',
  '72000000-0000-0000-0000-000000000002',
  '73000000-0000-0000-0000-000000000003'
)
on conflict (id) do nothing;

insert into public.organizations (id, name, slug, created_by)
values
  ('c1000000-0000-0000-0000-000000000001', 'Processing Organization A', 'processing-organization-a', '71000000-0000-0000-0000-000000000001'),
  ('c2000000-0000-0000-0000-000000000002', 'Processing Organization B', 'processing-organization-b', '72000000-0000-0000-0000-000000000002');

insert into public.organization_members (organization_id, user_id, role)
values
  ('c1000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'owner'),
  ('c1000000-0000-0000-0000-000000000001', '73000000-0000-0000-0000-000000000003', 'viewer'),
  ('c2000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000002', 'owner');

insert into public.evidence_documents (
  id, organization_id, uploaded_by, title, category, file_name, file_path, mime_type, file_size_bytes
)
values
  (
    'd1000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000001',
    'Processing evidence A',
    'technical',
    'evidence-a.pdf',
    'c1000000-0000-0000-0000-000000000001/d1000000-0000-0000-0000-000000000001/evidence-a.pdf',
    'application/pdf',
    1024
  ),
  (
    'd2000000-0000-0000-0000-000000000002',
    'c2000000-0000-0000-0000-000000000002',
    '72000000-0000-0000-0000-000000000002',
    'Processing evidence B',
    'technical',
    'evidence-b.pdf',
    'c2000000-0000-0000-0000-000000000002/d2000000-0000-0000-0000-000000000002/evidence-b.pdf',
    'application/pdf',
    1024
  );

insert into public.tenders (id, organization_id, created_by, title)
values
  ('e1000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'Processing tender A'),
  ('e2000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000002', 'Processing tender B');

insert into public.tender_documents (
  id, organization_id, tender_id, uploaded_by, title, file_name, file_path, mime_type, file_size_bytes
)
values
  (
    'f1000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000001',
    'Processing tender document A',
    'tender-a.pdf',
    'c1000000-0000-0000-0000-000000000001/e1000000-0000-0000-0000-000000000001/f1000000-0000-0000-0000-000000000001/tender-a.pdf',
    'application/pdf',
    2048
  ),
  (
    'f2000000-0000-0000-0000-000000000002',
    'c2000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000002',
    '72000000-0000-0000-0000-000000000002',
    'Processing tender document B',
    'tender-b.pdf',
    'c2000000-0000-0000-0000-000000000002/e2000000-0000-0000-0000-000000000002/f2000000-0000-0000-0000-000000000002/tender-b.pdf',
    'application/pdf',
    2048
  );

select is(
  (select count(*) from public.document_processing_jobs where status = 'queued'),
  4::bigint,
  'every evidence and tender document is queued atomically'
);

select throws_ok(
  $$update public.document_processing_jobs
    set status = 'completed'
    where evidence_document_id = 'd1000000-0000-0000-0000-000000000001'$$,
  '23514',
  'Document processing status transition is invalid.',
  'a queued job cannot skip directly to completed'
);

select lives_ok(
  $$update public.document_processing_jobs
    set status = 'processing', worker_reference = 'worker-test-a'
    where evidence_document_id = 'd1000000-0000-0000-0000-000000000001'$$,
  'a worker can claim a queued job'
);

select ok(
  (select started_at is not null
    from public.document_processing_jobs
    where evidence_document_id = 'd1000000-0000-0000-0000-000000000001'),
  'claiming a job records its start time'
);

select lives_ok(
  $$update public.document_processing_jobs
    set status = 'failed', last_error_code = 'PDF_READ', last_error_message = 'PDF non leggibile.'
    where evidence_document_id = 'd1000000-0000-0000-0000-000000000001'$$,
  'a processing job can fail with a traceable error'
);

select ok(
  (select failed_at is not null and last_error_code = 'PDF_READ'
    from public.document_processing_jobs
    where evidence_document_id = 'd1000000-0000-0000-0000-000000000001'),
  'failure time and error code are persisted'
);

update public.document_processing_jobs
set status = 'failed', last_error_message = 'Errore di test tenant B.'
where evidence_document_id = 'd2000000-0000-0000-0000-000000000002';

update public.document_processing_jobs
set status = 'processing', worker_reference = 'worker-test-page'
where tender_document_id = 'f1000000-0000-0000-0000-000000000001';

insert into public.document_processing_pages (
  id, organization_id, job_id, page_number, extracted_text
)
select
  'a1000000-0000-0000-0000-000000000001',
  organization_id,
  id,
  1,
  'Testo tecnico estratto dalla prima pagina.'
from public.document_processing_jobs
where tender_document_id = 'f1000000-0000-0000-0000-000000000001';

insert into public.document_processing_chunks (
  id, organization_id, job_id, page_id, chunk_index, content, character_start, character_end, token_count
)
select
  'a2000000-0000-0000-0000-000000000002',
  page.organization_id,
  page.job_id,
  page.id,
  0,
  page.extracted_text,
  0,
  char_length(page.extracted_text),
  7
from public.document_processing_pages page
where page.id = 'a1000000-0000-0000-0000-000000000001';

update public.document_processing_jobs
set status = 'completed'
where tender_document_id = 'f1000000-0000-0000-0000-000000000001';

set local role authenticated;
set local request.jwt.claim.sub = '71000000-0000-0000-0000-000000000001';
set local request.jwt.claim.email = 'processing-owner-a@example.test';
set local request.jwt.claim.role = 'authenticated';

select is(
  (select count(*) from public.document_processing_jobs),
  2::bigint,
  'an organization owner sees only processing jobs from their tenant'
);

select throws_ok(
  $$update public.document_processing_jobs
    set worker_reference = 'browser-mutation'
    where evidence_document_id = 'd1000000-0000-0000-0000-000000000001'$$,
  '42501',
  'permission denied for table document_processing_jobs',
  'authenticated users cannot mutate worker-owned processing state'
);

set local request.jwt.claim.sub = '73000000-0000-0000-0000-000000000003';
set local request.jwt.claim.email = 'processing-viewer-a@example.test';

select throws_ok(
  $$select public.retry_document_processing(
    (select id from public.document_processing_jobs
      where evidence_document_id = 'd1000000-0000-0000-0000-000000000001')
  )$$,
  '42501',
  'Document processing job not found or not retryable.',
  'a viewer cannot retry a failed job'
);

set local request.jwt.claim.sub = '71000000-0000-0000-0000-000000000001';
set local request.jwt.claim.email = 'processing-owner-a@example.test';

select lives_ok(
  $$select public.retry_document_processing(
    (select id from public.document_processing_jobs
      where evidence_document_id = 'd1000000-0000-0000-0000-000000000001')
  )$$,
  'an organization contributor can retry a failed job'
);

select ok(
  (select status = 'queued'
      and attempt_number = 2
      and retry_of_job_id is not null
    from public.document_processing_jobs
    where evidence_document_id = 'd1000000-0000-0000-0000-000000000001'
    order by attempt_number desc
    limit 1),
  'retry creates the next queued attempt and preserves history'
);

select throws_ok(
  $$select public.retry_document_processing(
    (select id from public.document_processing_jobs
      where evidence_document_id = 'd2000000-0000-0000-0000-000000000002')
  )$$,
  '42501',
  'Document processing job not found or not retryable.',
  'a contributor cannot retry another tenant job'
);

select is(
  (select count(*) from public.document_processing_pages),
  1::bigint,
  'organization members can read extracted pages from their tenant'
);

select is(
  (select count(*) from public.document_processing_chunks),
  1::bigint,
  'organization members can read extracted chunks from their tenant'
);

select is(
  (select status from public.document_processing_jobs
    where tender_document_id = 'f1000000-0000-0000-0000-000000000001'),
  'completed'::public.document_processing_status,
  'a processed source reaches the completed state without AI conclusions'
);

select * from finish();
rollback;
