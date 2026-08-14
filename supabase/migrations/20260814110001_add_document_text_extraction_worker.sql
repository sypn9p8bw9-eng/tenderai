begin;

create or replace function public.claim_document_processing_job(
  p_worker_reference text
)
returns setof public.document_processing_jobs
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_worker_reference is null
    or char_length(trim(p_worker_reference)) not between 1 and 200 then
    raise exception using
      errcode = '22023',
      message = 'Worker reference must contain between 1 and 200 characters.';
  end if;

  return query
  update public.document_processing_jobs as job
  set
    status = 'processing',
    worker_reference = trim(p_worker_reference)
  where job.id = (
    select queued.id
    from public.document_processing_jobs as queued
    where queued.status = 'queued'
    order by queued.queued_at, queued.id
    for update skip locked
    limit 1
  )
  returning job.*;
end;
$$;

create or replace function public.complete_document_processing_job(
  p_job_id uuid,
  p_worker_reference text,
  p_pages jsonb,
  p_chunks jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job public.document_processing_jobs%rowtype;
  v_page_count integer;
  v_distinct_page_count integer;
  v_min_page_number integer;
  v_max_page_number integer;
  v_chunk_count integer;
  v_distinct_chunk_count integer;
  v_min_chunk_index integer;
  v_max_chunk_index integer;
  v_inserted_chunk_count integer;
begin
  if p_worker_reference is null
    or char_length(trim(p_worker_reference)) not between 1 and 200 then
    raise exception using
      errcode = '22023',
      message = 'Worker reference must contain between 1 and 200 characters.';
  end if;

  if jsonb_typeof(p_pages) is distinct from 'array'
    or jsonb_typeof(p_chunks) is distinct from 'array' then
    raise exception using
      errcode = '22023',
      message = 'Processing pages and chunks must be JSON arrays.';
  end if;

  select * into v_job
  from public.document_processing_jobs
  where id = p_job_id
  for update;

  if not found
    or v_job.status <> 'processing'
    or v_job.worker_reference is distinct from trim(p_worker_reference) then
    raise exception using
      errcode = '23514',
      message = 'Document processing job is not owned by this worker.';
  end if;

  select
    count(*)::integer,
    count(distinct page.page_number)::integer,
    min(page.page_number),
    max(page.page_number)
  into
    v_page_count,
    v_distinct_page_count,
    v_min_page_number,
    v_max_page_number
  from jsonb_to_recordset(p_pages) as page(
    page_number integer,
    extracted_text text,
    metadata jsonb
  );

  if v_page_count = 0
    or v_distinct_page_count <> v_page_count
    or v_min_page_number <> 1
    or v_max_page_number <> v_page_count
    or exists (
      select 1
      from jsonb_to_recordset(p_pages) as page(
        page_number integer,
        extracted_text text,
        metadata jsonb
      )
      where page.extracted_text is null
        or (
          page.metadata is not null
          and jsonb_typeof(page.metadata) is distinct from 'object'
        )
    ) then
    raise exception using
      errcode = '22023',
      message = 'Processing pages must be complete, ordered, and valid.';
  end if;

  select
    count(*)::integer,
    count(distinct chunk.chunk_index)::integer,
    min(chunk.chunk_index),
    max(chunk.chunk_index)
  into
    v_chunk_count,
    v_distinct_chunk_count,
    v_min_chunk_index,
    v_max_chunk_index
  from jsonb_to_recordset(p_chunks) as chunk(
    page_number integer,
    chunk_index integer,
    content text,
    character_start integer,
    character_end integer,
    metadata jsonb
  );

  if v_chunk_count = 0
    or v_distinct_chunk_count <> v_chunk_count
    or v_min_chunk_index <> 0
    or v_max_chunk_index <> v_chunk_count - 1
    or exists (
      select 1
      from jsonb_to_recordset(p_chunks) as chunk(
        page_number integer,
        chunk_index integer,
        content text,
        character_start integer,
        character_end integer,
        metadata jsonb
      )
      where chunk.page_number is null
        or chunk.content is null
        or char_length(chunk.content) = 0
        or chunk.character_start is null
        or chunk.character_end is null
        or chunk.character_start < 0
        or chunk.character_end <= chunk.character_start
        or (
          chunk.metadata is not null
          and jsonb_typeof(chunk.metadata) is distinct from 'object'
        )
    ) then
    raise exception using
      errcode = '22023',
      message = 'Processing chunks must be non-empty, ordered, and valid.';
  end if;

  delete from public.document_processing_pages
  where job_id = v_job.id;

  insert into public.document_processing_pages (
    organization_id,
    job_id,
    page_number,
    extracted_text,
    metadata
  )
  select
    v_job.organization_id,
    v_job.id,
    page.page_number,
    page.extracted_text,
    coalesce(page.metadata, '{}'::jsonb)
  from jsonb_to_recordset(p_pages) as page(
    page_number integer,
    extracted_text text,
    metadata jsonb
  )
  order by page.page_number;

  insert into public.document_processing_chunks (
    organization_id,
    job_id,
    page_id,
    chunk_index,
    content,
    character_start,
    character_end,
    metadata
  )
  select
    v_job.organization_id,
    v_job.id,
    page.id,
    chunk.chunk_index,
    chunk.content,
    chunk.character_start,
    chunk.character_end,
    coalesce(chunk.metadata, '{}'::jsonb)
  from jsonb_to_recordset(p_chunks) as chunk(
    page_number integer,
    chunk_index integer,
    content text,
    character_start integer,
    character_end integer,
    metadata jsonb
  )
  join public.document_processing_pages as page
    on page.job_id = v_job.id
    and page.organization_id = v_job.organization_id
    and page.page_number = chunk.page_number
  where chunk.content = substring(
    page.extracted_text
    from chunk.character_start + 1
    for chunk.character_end - chunk.character_start
  )
  order by chunk.chunk_index;

  get diagnostics v_inserted_chunk_count = row_count;

  if v_inserted_chunk_count <> v_chunk_count then
    raise exception using
      errcode = '22023',
      message = 'Processing chunks do not match their source pages.';
  end if;

  update public.document_processing_jobs
  set status = 'completed'
  where id = v_job.id;
end;
$$;

create or replace function public.fail_document_processing_job(
  p_job_id uuid,
  p_worker_reference text,
  p_error_code text,
  p_error_message text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_job public.document_processing_jobs%rowtype;
begin
  if p_worker_reference is null
    or char_length(trim(p_worker_reference)) not between 1 and 200
    or p_error_code is null
    or char_length(trim(p_error_code)) not between 1 and 80
    or p_error_message is null
    or char_length(trim(p_error_message)) not between 1 and 1000 then
    raise exception using
      errcode = '22023',
      message = 'Worker failure details are invalid.';
  end if;

  select * into v_job
  from public.document_processing_jobs
  where id = p_job_id
  for update;

  if not found
    or v_job.status <> 'processing'
    or v_job.worker_reference is distinct from trim(p_worker_reference) then
    raise exception using
      errcode = '23514',
      message = 'Document processing job is not owned by this worker.';
  end if;

  delete from public.document_processing_pages
  where job_id = v_job.id;

  update public.document_processing_jobs
  set
    status = 'failed',
    last_error_code = trim(p_error_code),
    last_error_message = trim(p_error_message)
  where id = v_job.id;
end;
$$;

revoke all on function public.claim_document_processing_job(text)
from public, anon, authenticated;
revoke all on function public.complete_document_processing_job(uuid, text, jsonb, jsonb)
from public, anon, authenticated;
revoke all on function public.fail_document_processing_job(uuid, text, text, text)
from public, anon, authenticated;

grant execute on function public.claim_document_processing_job(text)
to service_role;
grant execute on function public.complete_document_processing_job(uuid, text, jsonb, jsonb)
to service_role;
grant execute on function public.fail_document_processing_job(uuid, text, text, text)
to service_role;

comment on function public.claim_document_processing_job(text) is
  'Atomically claims the oldest queued document job with SKIP LOCKED. Callable only by the server-side service worker.';
comment on function public.complete_document_processing_job(uuid, text, jsonb, jsonb) is
  'Atomically persists worker-produced PDF pages and deterministic chunks, then completes the owned processing job.';
comment on function public.fail_document_processing_job(uuid, text, text, text) is
  'Atomically clears partial output and records a terminal technical extraction failure for the owning worker.';

commit;
