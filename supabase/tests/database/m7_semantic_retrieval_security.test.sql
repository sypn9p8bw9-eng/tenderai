begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email, email_confirmed_at)
values
  ('77000000-0000-0000-0000-000000000001', 'm7-owner-a@example.test', now()),
  ('77000000-0000-0000-0000-000000000002', 'm7-owner-b@example.test', now());

insert into public.profiles (id)
values
  ('77000000-0000-0000-0000-000000000001'),
  ('77000000-0000-0000-0000-000000000002')
on conflict (id) do nothing;

insert into public.organizations (id, name, slug, created_by)
values
  (
    'c7000000-0000-0000-0000-000000000001',
    'M7 Organization A',
    'm7-organization-a',
    '77000000-0000-0000-0000-000000000001'
  ),
  (
    'c7000000-0000-0000-0000-000000000002',
    'M7 Organization B',
    'm7-organization-b',
    '77000000-0000-0000-0000-000000000002'
  );

insert into public.organization_members (organization_id, user_id, role)
values
  (
    'c7000000-0000-0000-0000-000000000001',
    '77000000-0000-0000-0000-000000000001',
    'owner'
  ),
  (
    'c7000000-0000-0000-0000-000000000002',
    '77000000-0000-0000-0000-000000000002',
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
    'd7100000-0000-0000-0000-000000000001',
    'c7000000-0000-0000-0000-000000000001',
    '77000000-0000-0000-0000-000000000001',
    'Evidence organization A',
    'technical',
    'organization-a.pdf',
    'c7000000-0000-0000-0000-000000000001/d7100000-0000-0000-0000-000000000001/organization-a.pdf',
    'application/pdf',
    1024
  ),
  (
    'd7200000-0000-0000-0000-000000000002',
    'c7000000-0000-0000-0000-000000000002',
    '77000000-0000-0000-0000-000000000002',
    'Evidence organization B',
    'technical',
    'organization-b.pdf',
    'c7000000-0000-0000-0000-000000000002/d7200000-0000-0000-0000-000000000002/organization-b.pdf',
    'application/pdf',
    1024
  );

set local role service_role;

update public.document_processing_jobs
set status = 'processing', worker_reference = 'm7-extraction-setup'
where evidence_document_id in (
  'd7100000-0000-0000-0000-000000000001',
  'd7200000-0000-0000-0000-000000000002'
);

insert into public.document_processing_pages (
  id,
  organization_id,
  job_id,
  page_number,
  extracted_text
)
select
  case
    when organization_id = 'c7000000-0000-0000-0000-000000000001'
      then 'a7100000-0000-0000-0000-000000000001'::uuid
    else 'a7200000-0000-0000-0000-000000000002'::uuid
  end,
  organization_id,
  id,
  1,
  case
    when organization_id = 'c7000000-0000-0000-0000-000000000001'
      then 'Testo riservato dell organizzazione A.'
    else 'Testo riservato dell organizzazione B.'
  end
from public.document_processing_jobs
where evidence_document_id in (
  'd7100000-0000-0000-0000-000000000001',
  'd7200000-0000-0000-0000-000000000002'
);

insert into public.document_processing_chunks (
  id,
  organization_id,
  job_id,
  page_id,
  chunk_index,
  content,
  character_start,
  character_end
)
select
  case
    when organization_id = 'c7000000-0000-0000-0000-000000000001'
      then 'b7100000-0000-0000-0000-000000000001'::uuid
    else 'b7200000-0000-0000-0000-000000000002'::uuid
  end,
  organization_id,
  job_id,
  id,
  0,
  extracted_text,
  0,
  char_length(extracted_text)
from public.document_processing_pages
where organization_id in (
  'c7000000-0000-0000-0000-000000000001',
  'c7000000-0000-0000-0000-000000000002'
);

update public.document_processing_jobs
set status = 'completed'
where evidence_document_id in (
  'd7100000-0000-0000-0000-000000000001',
  'd7200000-0000-0000-0000-000000000002'
);

reset role;

select ok(
  not has_table_privilege('authenticated', 'public.document_chunk_embeddings', 'select')
  and not has_table_privilege('authenticated', 'public.document_chunk_embeddings', 'insert')
  and not has_table_privilege('authenticated', 'public.document_chunk_embeddings', 'update')
  and not has_table_privilege('authenticated', 'public.document_chunk_embeddings', 'delete'),
  'authenticated users have no direct embedding table privileges'
);

select ok(
  has_table_privilege('service_role', 'public.document_chunk_embeddings', 'select')
  and has_table_privilege('service_role', 'public.document_chunk_embeddings', 'insert')
  and has_table_privilege('service_role', 'public.document_chunk_embeddings', 'update'),
  'service role can manage worker-owned embeddings'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.claim_document_embedding_batch(text,text,integer)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'public.complete_document_embedding_batch(text,text,jsonb)',
    'execute'
  )
  and not has_function_privilege(
    'authenticated',
    'public.fail_document_embedding_batch(text,text,uuid[],text,text)',
    'execute'
  ),
  'authenticated users cannot execute embedding worker functions'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.match_document_chunks(uuid,extensions.vector,text,text,integer)',
    'execute'
  ),
  'authenticated users cannot call the server-only retrieval function'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"77000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$select count(*) from public.document_chunk_embeddings$$,
  '42501',
  'permission denied for table document_chunk_embeddings',
  'organization members cannot bypass retrieval by selecting vectors directly'
);

reset role;
set local role service_role;

select is(
  (
    select count(*)
    from public.claim_document_embedding_batch(
      'm7-test-model',
      'm7-embedding-worker',
      10
    )
  ),
  2::bigint,
  'the service worker claims all missing test chunks once'
);

select lives_ok(
  $$select public.complete_document_embedding_batch(
    'm7-test-model',
    'm7-embedding-worker',
    (
      select jsonb_agg(
        jsonb_build_object(
          'chunk_id', stored.chunk_id,
          'embedding', (
            select jsonb_agg(
              case
                when stored.organization_id = 'c7000000-0000-0000-0000-000000000001'
                  then 1
                else -1
              end
            )
            from generate_series(1, 1536)
          )
        )
      )
      from public.document_chunk_embeddings as stored
      where stored.model = 'm7-test-model'
        and stored.worker_reference = 'm7-embedding-worker'
    )
  )$$,
  'the service worker can complete a valid embedding batch'
);

select is(
  (
    select count(*)
    from public.document_chunk_embeddings
    where model = 'm7-test-model' and status = 'completed'
  ),
  2::bigint,
  'one completed model-tagged embedding is stored per chunk'
);

select is(
  (
    select count(*)
    from public.claim_document_embedding_batch(
      'm7-test-model',
      'm7-idempotency-worker',
      10
    )
  ),
  0::bigint,
  'completed embeddings are not claimed again for the same model'
);

select is(
  (
    select count(*)
    from public.match_document_chunks(
      'c7000000-0000-0000-0000-000000000001',
      (
        select ('[' || string_agg('1', ',') || ']')::extensions.vector(1536)
        from generate_series(1, 1536)
      ),
      'm7-test-model',
      'all',
      10
    )
  ),
  1::bigint,
  'organization A retrieval cannot return organization B chunks'
);

select is(
  (
    select document_title
    from public.match_document_chunks(
      'c7000000-0000-0000-0000-000000000001',
      (
        select ('[' || string_agg('1', ',') || ']')::extensions.vector(1536)
        from generate_series(1, 1536)
      ),
      'm7-test-model',
      'evidence',
      1
    )
  ),
  'Evidence organization A'::text,
  'retrieval returns source provenance from the requested tenant'
);

select is(
  (
    select count(*)
    from public.match_document_chunks(
      'c7000000-0000-0000-0000-000000000001',
      (
        select ('[' || string_agg('1', ',') || ']')::extensions.vector(1536)
        from generate_series(1, 1536)
      ),
      'm7-test-model',
      'tender',
      10
    )
  ),
  0::bigint,
  'source filtering excludes non-tender chunks'
);

select throws_ok(
  $$select public.complete_document_embedding_batch(
    'm7-test-model',
    'wrong-worker',
    jsonb_build_array(
      jsonb_build_object(
        'chunk_id', 'b7100000-0000-0000-0000-000000000001',
        'embedding', (
          select jsonb_agg(1) from generate_series(1, 1536)
        )
      )
    )
  )$$,
  '23514',
  'Embedding batch is not fully owned by this worker.',
  'a worker cannot overwrite a completed or unowned embedding'
);

select * from finish();
rollback;
