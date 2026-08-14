begin;

drop function if exists public.claim_document_embedding_batch(text, text, integer);

create function public.claim_document_embedding_batch(
  p_model text,
  p_worker_reference text,
  p_limit integer default 32
)
returns table (
  claimed_embedding_id uuid,
  claimed_organization_id uuid,
  claimed_job_id uuid,
  claimed_chunk_id uuid,
  claimed_chunk_text text
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
    select embedding_candidate.id as candidate_embedding_id
    from public.document_chunk_embeddings as embedding_candidate
    where embedding_candidate.model = trim(p_model)
      and embedding_candidate.attempt_number < embedding_candidate.max_attempts
      and (
        embedding_candidate.status = 'failed'
        or (
          embedding_candidate.status = 'processing'
          and embedding_candidate.claimed_at < now() - interval '15 minutes'
        )
      )
    order by embedding_candidate.claimed_at, embedding_candidate.id
    for update of embedding_candidate skip locked
    limit p_limit
  ), reclaimed_embeddings as (
    update public.document_chunk_embeddings as embedding_record
    set
      status = 'processing',
      embedding = null,
      worker_reference = trim(p_worker_reference),
      attempt_number = embedding_record.attempt_number + 1,
      claimed_at = now(),
      completed_at = null,
      failed_at = null,
      last_error_code = null,
      last_error_message = null,
      updated_at = now()
    from retry_candidates
    where embedding_record.id = retry_candidates.candidate_embedding_id
    returning
      embedding_record.id as returned_embedding_id,
      embedding_record.organization_id as returned_organization_id,
      embedding_record.job_id as returned_job_id,
      embedding_record.chunk_id as returned_chunk_id
  )
  select
    reclaimed_embeddings.returned_embedding_id,
    reclaimed_embeddings.returned_organization_id,
    reclaimed_embeddings.returned_job_id,
    reclaimed_embeddings.returned_chunk_id,
    processing_chunk.content
  from reclaimed_embeddings
  join public.document_processing_chunks as processing_chunk
    on processing_chunk.id = reclaimed_embeddings.returned_chunk_id
    and processing_chunk.job_id = reclaimed_embeddings.returned_job_id
    and processing_chunk.organization_id = reclaimed_embeddings.returned_organization_id
  order by
    processing_chunk.created_at,
    processing_chunk.chunk_index,
    processing_chunk.id;

  get diagnostics v_claimed = row_count;
  v_remaining := p_limit - v_claimed;

  if v_remaining <= 0 then
    return;
  end if;

  return query
  with missing_candidates as (
    select
      processing_chunk.organization_id as candidate_organization_id,
      processing_chunk.job_id as candidate_job_id,
      processing_chunk.id as candidate_chunk_id
    from public.document_processing_chunks as processing_chunk
    join public.document_processing_jobs as processing_job
      on processing_job.id = processing_chunk.job_id
      and processing_job.organization_id = processing_chunk.organization_id
    where processing_job.status = 'completed'
      and not exists (
        select 1
        from public.document_chunk_embeddings as existing_embedding
        where existing_embedding.chunk_id = processing_chunk.id
          and existing_embedding.model = trim(p_model)
      )
    order by
      processing_job.completed_at,
      processing_chunk.chunk_index,
      processing_chunk.id
    limit v_remaining
  ), inserted_embeddings as (
    insert into public.document_chunk_embeddings as embedding_record (
      organization_id,
      job_id,
      chunk_id,
      model,
      worker_reference
    )
    select
      missing_candidates.candidate_organization_id,
      missing_candidates.candidate_job_id,
      missing_candidates.candidate_chunk_id,
      trim(p_model),
      trim(p_worker_reference)
    from missing_candidates
    on conflict on constraint document_chunk_embeddings_chunk_model_unique
    do nothing
    returning
      embedding_record.id as returned_embedding_id,
      embedding_record.organization_id as returned_organization_id,
      embedding_record.job_id as returned_job_id,
      embedding_record.chunk_id as returned_chunk_id
  )
  select
    inserted_embeddings.returned_embedding_id,
    inserted_embeddings.returned_organization_id,
    inserted_embeddings.returned_job_id,
    inserted_embeddings.returned_chunk_id,
    processing_chunk.content
  from inserted_embeddings
  join public.document_processing_chunks as processing_chunk
    on processing_chunk.id = inserted_embeddings.returned_chunk_id
    and processing_chunk.job_id = inserted_embeddings.returned_job_id
    and processing_chunk.organization_id = inserted_embeddings.returned_organization_id
  order by
    processing_chunk.created_at,
    processing_chunk.chunk_index,
    processing_chunk.id;
end;
$$;

revoke all on function public.claim_document_embedding_batch(text, text, integer)
from public, anon, authenticated;

grant execute on function public.claim_document_embedding_batch(text, text, integer)
to service_role;

comment on function public.claim_document_embedding_batch(text, text, integer) is
  'Claims missing, failed, or abandoned chunk embeddings for one model. Output names and all internal column references are unambiguous. Service-role worker only.';

commit;
