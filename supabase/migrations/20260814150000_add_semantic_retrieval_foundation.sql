begin;

create extension if not exists vector with schema extensions;

create type public.document_embedding_status as enum (
  'processing',
  'completed',
  'failed'
);

alter table public.document_processing_chunks
  add constraint document_processing_chunks_identity_unique
  unique (id, job_id, organization_id);

create table public.document_chunk_embeddings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid not null,
  chunk_id uuid not null,
  model text not null,
  embedding extensions.vector(1536),
  status public.document_embedding_status not null default 'processing',
  worker_reference text not null,
  attempt_number smallint not null default 1,
  max_attempts smallint not null default 3,
  claimed_at timestamptz not null default now(),
  completed_at timestamptz,
  failed_at timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_chunk_embeddings_chunk_scope_fkey
    foreign key (chunk_id, job_id, organization_id)
    references public.document_processing_chunks (id, job_id, organization_id)
    on delete cascade,
  constraint document_chunk_embeddings_chunk_model_unique
    unique (chunk_id, model),
  constraint document_chunk_embeddings_model_length
    check (char_length(trim(model)) between 1 and 200),
  constraint document_chunk_embeddings_worker_reference_length
    check (char_length(trim(worker_reference)) between 1 and 200),
  constraint document_chunk_embeddings_attempt_range
    check (attempt_number between 1 and max_attempts and max_attempts between 1 and 10),
  constraint document_chunk_embeddings_error_code_length
    check (last_error_code is null or char_length(trim(last_error_code)) between 1 and 80),
  constraint document_chunk_embeddings_error_message_length
    check (last_error_message is null or char_length(trim(last_error_message)) between 1 and 1000),
  constraint document_chunk_embeddings_state_consistency
    check (
      (
        status = 'processing'
        and embedding is null
        and completed_at is null
        and failed_at is null
        and last_error_code is null
        and last_error_message is null
      )
      or (
        status = 'completed'
        and embedding is not null
        and completed_at is not null
        and failed_at is null
        and last_error_code is null
        and last_error_message is null
      )
      or (
        status = 'failed'
        and embedding is null
        and completed_at is null
        and failed_at is not null
        and last_error_code is not null
        and last_error_message is not null
      )
    )
);

create index document_chunk_embeddings_organization_model_status_idx
  on public.document_chunk_embeddings (organization_id, model, status);

create index document_chunk_embeddings_job_idx
  on public.document_chunk_embeddings (job_id);

create index document_chunk_embeddings_vector_hnsw_idx
  on public.document_chunk_embeddings
  using hnsw (embedding extensions.vector_cosine_ops)
  where status = 'completed';

alter table public.document_chunk_embeddings enable row level security;

revoke all on table public.document_chunk_embeddings
from public, anon, authenticated;

grant select, insert, update, delete on table public.document_chunk_embeddings
to service_role;

grant usage on type public.document_embedding_status to service_role;

create or replace function public.claim_document_embedding_batch(
  p_model text,
  p_worker_reference text,
  p_limit integer default 32
)
returns table (
  embedding_id uuid,
  organization_id uuid,
  job_id uuid,
  chunk_id uuid,
  chunk_text text
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claimed integer := 0;
  v_remaining integer;
begin
  if p_model is null
    or char_length(trim(p_model)) not between 1 and 200
    or p_worker_reference is null
    or char_length(trim(p_worker_reference)) not between 1 and 200
    or p_limit is null
    or p_limit not between 1 and 100 then
    raise exception using
      errcode = '22023',
      message = 'Embedding claim parameters are invalid.';
  end if;

  return query
  with retry_candidates as (
    select existing.id
    from public.document_chunk_embeddings as existing
    where existing.model = trim(p_model)
      and existing.attempt_number < existing.max_attempts
      and (
        existing.status = 'failed'
        or (
          existing.status = 'processing'
          and existing.claimed_at < now() - interval '15 minutes'
        )
      )
    order by existing.claimed_at, existing.id
    for update skip locked
    limit p_limit
  ), reclaimed as (
    update public.document_chunk_embeddings as existing
    set
      status = 'processing',
      embedding = null,
      worker_reference = trim(p_worker_reference),
      attempt_number = existing.attempt_number + 1,
      claimed_at = now(),
      completed_at = null,
      failed_at = null,
      last_error_code = null,
      last_error_message = null,
      updated_at = now()
    from retry_candidates
    where existing.id = retry_candidates.id
    returning
      existing.id,
      existing.organization_id,
      existing.job_id,
      existing.chunk_id
  )
  select
    reclaimed.id,
    reclaimed.organization_id,
    reclaimed.job_id,
    reclaimed.chunk_id,
    chunk.content
  from reclaimed
  join public.document_processing_chunks as chunk
    on chunk.id = reclaimed.chunk_id
    and chunk.job_id = reclaimed.job_id
    and chunk.organization_id = reclaimed.organization_id
  order by chunk.created_at, chunk.chunk_index, chunk.id;

  get diagnostics v_claimed = row_count;
  v_remaining := p_limit - v_claimed;

  if v_remaining <= 0 then
    return;
  end if;

  return query
  with candidates as (
    select
      chunk.organization_id,
      chunk.job_id,
      chunk.id as chunk_id
    from public.document_processing_chunks as chunk
    join public.document_processing_jobs as job
      on job.id = chunk.job_id
      and job.organization_id = chunk.organization_id
    where job.status = 'completed'
      and not exists (
        select 1
        from public.document_chunk_embeddings as existing
        where existing.chunk_id = chunk.id
          and existing.model = trim(p_model)
      )
    order by job.completed_at, chunk.chunk_index, chunk.id
    limit v_remaining
  ), inserted as (
    insert into public.document_chunk_embeddings (
      organization_id,
      job_id,
      chunk_id,
      model,
      worker_reference
    )
    select
      candidates.organization_id,
      candidates.job_id,
      candidates.chunk_id,
      trim(p_model),
      trim(p_worker_reference)
    from candidates
    on conflict (chunk_id, model) do nothing
    returning
      id,
      organization_id,
      job_id,
      chunk_id
  )
  select
    inserted.id,
    inserted.organization_id,
    inserted.job_id,
    inserted.chunk_id,
    chunk.content
  from inserted
  join public.document_processing_chunks as chunk
    on chunk.id = inserted.chunk_id
    and chunk.job_id = inserted.job_id
    and chunk.organization_id = inserted.organization_id
  order by chunk.created_at, chunk.chunk_index, chunk.id;
end;
$$;

create or replace function public.complete_document_embedding_batch(
  p_model text,
  p_worker_reference text,
  p_embeddings jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_payload_count integer;
  v_updated_count integer;
begin
  if p_model is null
    or char_length(trim(p_model)) not between 1 and 200
    or p_worker_reference is null
    or char_length(trim(p_worker_reference)) not between 1 and 200
    or jsonb_typeof(p_embeddings) is distinct from 'array' then
    raise exception using
      errcode = '22023',
      message = 'Embedding completion parameters are invalid.';
  end if;

  select count(*)::integer into v_payload_count
  from jsonb_to_recordset(p_embeddings) as payload(
    chunk_id uuid,
    embedding jsonb
  );

  if v_payload_count not between 1 and 100
    or (
      select count(distinct payload.chunk_id)
      from jsonb_to_recordset(p_embeddings) as payload(
        chunk_id uuid,
        embedding jsonb
      )
    ) <> v_payload_count
    or exists (
      select 1
      from jsonb_to_recordset(p_embeddings) as payload(
        chunk_id uuid,
        embedding jsonb
      )
      where payload.chunk_id is null
        or jsonb_typeof(payload.embedding) is distinct from 'array'
        or jsonb_array_length(payload.embedding) <> 1536
        or exists (
          select 1
          from jsonb_array_elements(payload.embedding) as coordinate(value)
          where jsonb_typeof(coordinate.value) <> 'number'
        )
    ) then
    raise exception using
      errcode = '22023',
      message = 'Embedding payload must contain unique chunks and 1536 numeric dimensions.';
  end if;

  update public.document_chunk_embeddings as existing
  set
    embedding = payload.embedding::text::extensions.vector(1536),
    status = 'completed',
    completed_at = now(),
    updated_at = now()
  from jsonb_to_recordset(p_embeddings) as payload(
    chunk_id uuid,
    embedding jsonb
  )
  where existing.chunk_id = payload.chunk_id
    and existing.model = trim(p_model)
    and existing.status = 'processing'
    and existing.worker_reference = trim(p_worker_reference);

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> v_payload_count then
    raise exception using
      errcode = '23514',
      message = 'Embedding batch is not fully owned by this worker.';
  end if;
end;
$$;

create or replace function public.fail_document_embedding_batch(
  p_model text,
  p_worker_reference text,
  p_chunk_ids uuid[],
  p_error_code text,
  p_error_message text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_updated_count integer;
begin
  if p_model is null
    or char_length(trim(p_model)) not between 1 and 200
    or p_worker_reference is null
    or char_length(trim(p_worker_reference)) not between 1 and 200
    or p_chunk_ids is null
    or cardinality(p_chunk_ids) not between 1 and 100
    or cardinality(p_chunk_ids) <> (
      select count(distinct chunk_id)
      from unnest(p_chunk_ids) as chunk_id
    )
    or p_error_code is null
    or char_length(trim(p_error_code)) not between 1 and 80
    or p_error_message is null
    or char_length(trim(p_error_message)) not between 1 and 1000 then
    raise exception using
      errcode = '22023',
      message = 'Embedding failure parameters are invalid.';
  end if;

  update public.document_chunk_embeddings as existing
  set
    status = 'failed',
    failed_at = now(),
    last_error_code = trim(p_error_code),
    last_error_message = trim(p_error_message),
    updated_at = now()
  where existing.chunk_id = any(p_chunk_ids)
    and existing.model = trim(p_model)
    and existing.status = 'processing'
    and existing.worker_reference = trim(p_worker_reference);

  get diagnostics v_updated_count = row_count;

  if v_updated_count <> cardinality(p_chunk_ids) then
    raise exception using
      errcode = '23514',
      message = 'Embedding batch is not fully owned by this worker.';
  end if;
end;
$$;

create or replace function public.match_document_chunks(
  p_organization_id uuid,
  p_query_embedding extensions.vector(1536),
  p_model text,
  p_source text default 'all',
  p_top_k integer default 5
)
returns table (
  chunk_id uuid,
  page_number integer,
  chunk_text text,
  document_title text,
  file_name text,
  source_type text,
  similarity double precision
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_organization_id is null
    or p_query_embedding is null
    or p_model is null
    or char_length(trim(p_model)) not between 1 and 200
    or p_source not in ('all', 'evidence', 'tender')
    or p_top_k is null
    or p_top_k not between 1 and 50 then
    raise exception using
      errcode = '22023',
      message = 'Semantic retrieval parameters are invalid.';
  end if;

  return query
  select
    chunk.id,
    page.page_number,
    chunk.content,
    coalesce(evidence.title, tender_document.title),
    coalesce(evidence.file_name, tender_document.file_name),
    case
      when job.evidence_document_id is not null then 'evidence'
      else 'tender'
    end,
    (1 - (stored.embedding <=> p_query_embedding))::double precision
  from public.document_chunk_embeddings as stored
  join public.document_processing_chunks as chunk
    on chunk.id = stored.chunk_id
    and chunk.job_id = stored.job_id
    and chunk.organization_id = stored.organization_id
  join public.document_processing_pages as page
    on page.id = chunk.page_id
    and page.job_id = chunk.job_id
    and page.organization_id = chunk.organization_id
  join public.document_processing_jobs as job
    on job.id = chunk.job_id
    and job.organization_id = chunk.organization_id
  left join public.evidence_documents as evidence
    on evidence.id = job.evidence_document_id
    and evidence.organization_id = job.organization_id
  left join public.tender_documents as tender_document
    on tender_document.id = job.tender_document_id
    and tender_document.organization_id = job.organization_id
  where stored.organization_id = p_organization_id
    and stored.model = trim(p_model)
    and stored.status = 'completed'
    and (
      p_source = 'all'
      or (p_source = 'evidence' and job.evidence_document_id is not null)
      or (p_source = 'tender' and job.tender_document_id is not null)
    )
  order by stored.embedding <=> p_query_embedding
  limit p_top_k;
end;
$$;

revoke all on function public.claim_document_embedding_batch(text, text, integer)
from public, anon, authenticated;
revoke all on function public.complete_document_embedding_batch(text, text, jsonb)
from public, anon, authenticated;
revoke all on function public.fail_document_embedding_batch(text, text, uuid[], text, text)
from public, anon, authenticated;
revoke all on function public.match_document_chunks(uuid, extensions.vector, text, text, integer)
from public, anon, authenticated;

grant execute on function public.claim_document_embedding_batch(text, text, integer)
to service_role;
grant execute on function public.complete_document_embedding_batch(text, text, jsonb)
to service_role;
grant execute on function public.fail_document_embedding_batch(text, text, uuid[], text, text)
to service_role;
grant execute on function public.match_document_chunks(uuid, extensions.vector, text, text, integer)
to service_role;

comment on table public.document_chunk_embeddings is
  'Server-worker-owned semantic vectors for extracted source chunks. Rows contain no AI conclusions and are not directly exposed to authenticated clients.';
comment on function public.claim_document_embedding_batch(text, text, integer) is
  'Claims missing, failed, or abandoned chunk embeddings for one model. Service-role worker only.';
comment on function public.complete_document_embedding_batch(text, text, jsonb) is
  'Validates and atomically completes a worker-owned batch of 1536-dimensional embeddings.';
comment on function public.fail_document_embedding_batch(text, text, uuid[], text, text) is
  'Records a bounded provider or persistence failure for a worker-owned embedding batch.';
comment on function public.match_document_chunks(uuid, extensions.vector, text, text, integer) is
  'Returns organization-scoped source chunks ordered by cosine similarity. Service-side retrieval only; it generates no answer or compliance conclusion.';

commit;
