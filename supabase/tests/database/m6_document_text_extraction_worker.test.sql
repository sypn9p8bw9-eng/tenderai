begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email, email_confirmed_at)
values (
  '76000000-0000-0000-0000-000000000001',
  'worker-owner@example.test',
  now()
);

insert into public.profiles (id)
values ('76000000-0000-0000-0000-000000000001')
on conflict (id) do nothing;

insert into public.organizations (id, name, slug, created_by)
values (
  'c6000000-0000-0000-0000-000000000001',
  'Worker Organization',
  'worker-organization',
  '76000000-0000-0000-0000-000000000001'
);

insert into public.organization_members (organization_id, user_id, role)
values (
  'c6000000-0000-0000-0000-000000000001',
  '76000000-0000-0000-0000-000000000001',
  'owner'
);

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
    'd6100000-0000-0000-0000-000000000001',
    'c6000000-0000-0000-0000-000000000001',
    '76000000-0000-0000-0000-000000000001',
    'Worker evidence one',
    'technical',
    'worker-one.pdf',
    'c6000000-0000-0000-0000-000000000001/d6100000-0000-0000-0000-000000000001/worker-one.pdf',
    'application/pdf',
    1024
  ),
  (
    'd6200000-0000-0000-0000-000000000002',
    'c6000000-0000-0000-0000-000000000001',
    '76000000-0000-0000-0000-000000000001',
    'Worker evidence two',
    'technical',
    'worker-two.pdf',
    'c6000000-0000-0000-0000-000000000001/d6200000-0000-0000-0000-000000000002/worker-two.pdf',
    'application/pdf',
    1024
  );

select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_document_processing_job(text)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'public.complete_document_processing_job(uuid,text,jsonb,jsonb)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'public.fail_document_processing_job(uuid,text,text,text)',
    'execute'
  ),
  'authenticated users cannot execute worker lifecycle functions'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.claim_document_processing_job(text)',
    'execute'
  )
  and has_function_privilege(
    'service_role',
    'public.complete_document_processing_job(uuid,text,jsonb,jsonb)',
    'execute'
  )
  and has_function_privilege(
    'service_role',
    'public.fail_document_processing_job(uuid,text,text,text)',
    'execute'
  ),
  'service role can execute the narrow worker lifecycle functions'
);

set local role service_role;

select is(
  (select count(*) from public.claim_document_processing_job('m6-worker-complete')),
  1::bigint,
  'the worker atomically claims one queued job'
);

select is(
  (select count(*)
    from public.document_processing_jobs
    where status = 'processing' and worker_reference = 'm6-worker-complete'),
  1::bigint,
  'claim records processing state and worker ownership'
);

select throws_ok(
  $$select public.complete_document_processing_job(
    (select id from public.document_processing_jobs
      where worker_reference = 'm6-worker-complete'),
    'another-worker',
    '[]'::jsonb,
    '[]'::jsonb
  )$$,
  '23514',
  'Document processing job is not owned by this worker.',
  'another worker cannot complete the claimed job'
);

select throws_ok(
  $$select public.complete_document_processing_job(
    (select id from public.document_processing_jobs
      where worker_reference = 'm6-worker-complete'),
    'm6-worker-complete',
    '[{"page_number":1,"extracted_text":"Testo pagina uno.","metadata":{}}]'::jsonb,
    '[{"page_number":1,"chunk_index":0,"content":"Testo sbagliato","character_start":0,"character_end":15,"metadata":{}}]'::jsonb
  )$$,
  '22023',
  'Processing chunks do not match their source pages.',
  'completion rejects chunks that do not match page offsets'
);

select ok(
  (select count(*) = 0
    from public.document_processing_pages
    where job_id = (
      select id from public.document_processing_jobs
      where worker_reference = 'm6-worker-complete'
    ))
  and (
    select status = 'processing'
    from public.document_processing_jobs
    where worker_reference = 'm6-worker-complete'
  ),
  'invalid output rolls back without partial pages or state changes'
);

select lives_ok(
  $$select public.complete_document_processing_job(
    (select id from public.document_processing_jobs
      where worker_reference = 'm6-worker-complete'),
    'm6-worker-complete',
    '[
      {"page_number":1,"extracted_text":"Testo pagina uno.","metadata":{"source":"digital_pdf"}},
      {"page_number":2,"extracted_text":"Testo pagina due.","metadata":{"source":"digital_pdf"}}
    ]'::jsonb,
    '[
      {"page_number":1,"chunk_index":0,"content":"Testo pagina uno.","character_start":0,"character_end":17,"metadata":{}},
      {"page_number":2,"chunk_index":1,"content":"Testo pagina due.","character_start":0,"character_end":17,"metadata":{}}
    ]'::jsonb
  )$$,
  'valid page and chunk output completes atomically'
);

select is(
  (select status
    from public.document_processing_jobs
    where worker_reference = 'm6-worker-complete'),
  'completed'::public.document_processing_status,
  'completion records the terminal completed state'
);

select is(
  (select count(*)
    from public.document_processing_pages
    where job_id = (
      select id from public.document_processing_jobs
      where worker_reference = 'm6-worker-complete'
    )),
  2::bigint,
  'completion stores exactly one row per extracted page'
);

select is(
  (select count(*)
    from public.document_processing_chunks as chunk
    join public.document_processing_pages as page
      on page.id = chunk.page_id
      and page.job_id = chunk.job_id
      and page.organization_id = chunk.organization_id
    where chunk.job_id = (
      select id from public.document_processing_jobs
      where worker_reference = 'm6-worker-complete'
    )
      and chunk.content = substring(
        page.extracted_text
        from chunk.character_start + 1
        for chunk.character_end - chunk.character_start
      )),
  2::bigint,
  'chunks retain validated page references and exact character offsets'
);

select is(
  (select count(*) from public.claim_document_processing_job('m6-worker-fail')),
  1::bigint,
  'a second worker claims the next queued job without reusing the first'
);

select lives_ok(
  $$select public.fail_document_processing_job(
    (select id from public.document_processing_jobs
      where worker_reference = 'm6-worker-fail'),
    'm6-worker-fail',
    'NO_EXTRACTABLE_TEXT',
    'OCR is not implemented yet.'
  )$$,
  'the owning worker can record a clear technical failure'
);

select ok(
  (select status = 'failed'
      and failed_at is not null
      and last_error_code = 'NO_EXTRACTABLE_TEXT'
      and last_error_message = 'OCR is not implemented yet.'
    from public.document_processing_jobs
    where worker_reference = 'm6-worker-fail'),
  'failure persists its code, message, and timestamp'
);

set local role authenticated;
set local request.jwt.claim.sub = '76000000-0000-0000-0000-000000000001';
set local request.jwt.claim.email = 'worker-owner@example.test';
set local request.jwt.claim.role = 'authenticated';

select throws_ok(
  $$select public.claim_document_processing_job('browser-worker')$$,
  '42501',
  'permission denied for function claim_document_processing_job',
  'an authenticated browser session cannot claim queue work'
);

select * from finish();
rollback;
