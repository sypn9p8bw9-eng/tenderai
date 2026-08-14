begin;

create type public.document_processing_status as enum (
  'queued',
  'processing',
  'completed',
  'failed'
);

alter table public.evidence_documents
  add constraint evidence_documents_id_organization_unique
  unique (id, organization_id);

alter table public.tender_documents
  add constraint tender_documents_id_organization_unique
  unique (id, organization_id);

create table public.document_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  evidence_document_id uuid,
  tender_document_id uuid,
  status public.document_processing_status not null default 'queued',
  attempt_number smallint not null default 1,
  max_attempts smallint not null default 3,
  retry_of_job_id uuid references public.document_processing_jobs (id) on delete cascade,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  last_error_code text,
  last_error_message text,
  worker_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_processing_jobs_evidence_organization_fkey
    foreign key (evidence_document_id, organization_id)
    references public.evidence_documents (id, organization_id)
    on delete cascade,
  constraint document_processing_jobs_tender_organization_fkey
    foreign key (tender_document_id, organization_id)
    references public.tender_documents (id, organization_id)
    on delete cascade,
  constraint document_processing_jobs_one_source
    check (num_nonnulls(evidence_document_id, tender_document_id) = 1),
  constraint document_processing_jobs_attempt_range
    check (attempt_number between 1 and max_attempts and max_attempts between 1 and 10),
  constraint document_processing_jobs_error_code_length
    check (last_error_code is null or char_length(trim(last_error_code)) between 1 and 80),
  constraint document_processing_jobs_error_message_length
    check (last_error_message is null or char_length(trim(last_error_message)) between 1 and 1000),
  constraint document_processing_jobs_worker_reference_length
    check (worker_reference is null or char_length(trim(worker_reference)) between 1 and 200),
  constraint document_processing_jobs_state_consistency
    check (
      (
        status = 'queued'
        and started_at is null
        and completed_at is null
        and failed_at is null
        and last_error_code is null
        and last_error_message is null
      )
      or (
        status = 'processing'
        and started_at is not null
        and completed_at is null
        and failed_at is null
        and last_error_code is null
        and last_error_message is null
      )
      or (
        status = 'completed'
        and started_at is not null
        and completed_at is not null
        and failed_at is null
        and last_error_code is null
        and last_error_message is null
      )
      or (
        status = 'failed'
        and completed_at is null
        and failed_at is not null
        and last_error_message is not null
      )
    ),
  constraint document_processing_jobs_id_organization_unique
    unique (id, organization_id)
);

create unique index document_processing_jobs_active_evidence_idx
  on public.document_processing_jobs (evidence_document_id)
  where evidence_document_id is not null and status in ('queued', 'processing');

create unique index document_processing_jobs_active_tender_idx
  on public.document_processing_jobs (tender_document_id)
  where tender_document_id is not null and status in ('queued', 'processing');

create index document_processing_jobs_organization_status_queue_idx
  on public.document_processing_jobs (organization_id, status, queued_at);

create index document_processing_jobs_evidence_attempt_idx
  on public.document_processing_jobs (evidence_document_id, attempt_number desc)
  where evidence_document_id is not null;

create index document_processing_jobs_tender_attempt_idx
  on public.document_processing_jobs (tender_document_id, attempt_number desc)
  where tender_document_id is not null;

create index document_processing_jobs_retry_of_idx
  on public.document_processing_jobs (retry_of_job_id)
  where retry_of_job_id is not null;

create table public.document_processing_pages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid not null,
  page_number integer not null,
  extracted_text text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint document_processing_pages_job_organization_fkey
    foreign key (job_id, organization_id)
    references public.document_processing_jobs (id, organization_id)
    on delete cascade,
  constraint document_processing_pages_page_number_positive
    check (page_number > 0),
  constraint document_processing_pages_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint document_processing_pages_job_page_unique
    unique (job_id, page_number),
  constraint document_processing_pages_identity_unique
    unique (id, job_id, organization_id)
);

create index document_processing_pages_organization_job_idx
  on public.document_processing_pages (organization_id, job_id, page_number);

create table public.document_processing_chunks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  job_id uuid not null,
  page_id uuid not null,
  chunk_index integer not null,
  content text not null,
  character_start integer not null,
  character_end integer not null,
  token_count integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint document_processing_chunks_page_job_organization_fkey
    foreign key (page_id, job_id, organization_id)
    references public.document_processing_pages (id, job_id, organization_id)
    on delete cascade,
  constraint document_processing_chunks_index_nonnegative
    check (chunk_index >= 0),
  constraint document_processing_chunks_character_range
    check (character_start >= 0 and character_end > character_start),
  constraint document_processing_chunks_token_count_positive
    check (token_count is null or token_count > 0),
  constraint document_processing_chunks_content_not_empty
    check (char_length(content) > 0),
  constraint document_processing_chunks_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint document_processing_chunks_job_index_unique
    unique (job_id, chunk_index)
);

create index document_processing_chunks_organization_job_idx
  on public.document_processing_chunks (organization_id, job_id, chunk_index);

create index document_processing_chunks_page_idx
  on public.document_processing_chunks (page_id, chunk_index);

create or replace function private.protect_document_processing_job()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_previous public.document_processing_jobs%rowtype;
begin
  if tg_op = 'INSERT' then
    if new.status <> 'queued' then
      raise exception using
        errcode = '23514',
        message = 'New document processing jobs must be queued.';
    end if;

    new.queued_at := coalesce(new.queued_at, now());
    new.started_at := null;
    new.completed_at := null;
    new.failed_at := null;
    new.last_error_code := null;
    new.last_error_message := null;

    if new.retry_of_job_id is null then
      if new.attempt_number <> 1 then
        raise exception using
          errcode = '23514',
          message = 'Initial document processing jobs must use attempt one.';
      end if;
    else
      select * into v_previous
      from public.document_processing_jobs
      where id = new.retry_of_job_id
      for key share;

      if not found
        or v_previous.status <> 'failed'
        or v_previous.organization_id <> new.organization_id
        or v_previous.evidence_document_id is distinct from new.evidence_document_id
        or v_previous.tender_document_id is distinct from new.tender_document_id
        or new.attempt_number <> v_previous.attempt_number + 1
        or new.max_attempts <> v_previous.max_attempts
        or new.attempt_number > new.max_attempts then
        raise exception using
          errcode = '23514',
          message = 'Document processing retry chain is invalid.';
      end if;
    end if;

    return new;
  end if;

  if new.organization_id is distinct from old.organization_id
    or new.evidence_document_id is distinct from old.evidence_document_id
    or new.tender_document_id is distinct from old.tender_document_id
    or new.attempt_number is distinct from old.attempt_number
    or new.max_attempts is distinct from old.max_attempts
    or new.retry_of_job_id is distinct from old.retry_of_job_id
    or new.queued_at is distinct from old.queued_at
    or new.created_at is distinct from old.created_at then
    raise exception using
      errcode = '42501',
      message = 'Document processing job identity is immutable.';
  end if;

  if old.status in ('completed', 'failed') then
    raise exception using
      errcode = '23514',
      message = 'Completed and failed document processing jobs are immutable.';
  end if;

  if new.status = old.status then
    new.updated_at := now();
    return new;
  end if;

  if old.status = 'queued' and new.status = 'processing' then
    new.started_at := now();
  elsif old.status = 'queued' and new.status = 'failed' then
    new.failed_at := now();
  elsif old.status = 'processing' and new.status = 'completed' then
    new.completed_at := now();
  elsif old.status = 'processing' and new.status = 'failed' then
    new.failed_at := now();
  else
    raise exception using
      errcode = '23514',
      message = 'Document processing status transition is invalid.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.protect_document_processing_job()
from public, anon, authenticated;

create trigger document_processing_jobs_protect_state
before insert or update on public.document_processing_jobs
for each row execute function private.protect_document_processing_job();

create or replace function private.enqueue_document_processing_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'evidence_documents' then
    insert into public.document_processing_jobs (
      organization_id,
      evidence_document_id
    )
    values (
      new.organization_id,
      new.id
    );
  elsif tg_table_name = 'tender_documents' then
    insert into public.document_processing_jobs (
      organization_id,
      tender_document_id
    )
    values (
      new.organization_id,
      new.id
    );
  else
    raise exception using
      errcode = '22023',
      message = 'Unsupported document source for processing.';
  end if;

  return new;
end;
$$;

revoke all on function private.enqueue_document_processing_job()
from public, anon, authenticated;

create trigger evidence_documents_enqueue_processing
after insert on public.evidence_documents
for each row execute function private.enqueue_document_processing_job();

create trigger tender_documents_enqueue_processing
after insert on public.tender_documents
for each row execute function private.enqueue_document_processing_job();

insert into public.document_processing_jobs (
  organization_id,
  evidence_document_id
)
select
  evidence.organization_id,
  evidence.id
from public.evidence_documents evidence;

insert into public.document_processing_jobs (
  organization_id,
  tender_document_id
)
select
  tender_document.organization_id,
  tender_document.id
from public.tender_documents tender_document;

alter table public.document_processing_jobs enable row level security;
alter table public.document_processing_pages enable row level security;
alter table public.document_processing_chunks enable row level security;

create policy document_processing_jobs_select_member
on public.document_processing_jobs for select
to authenticated
using ((select private.is_organization_member(organization_id)));

create policy document_processing_pages_select_member
on public.document_processing_pages for select
to authenticated
using ((select private.is_organization_member(organization_id)));

create policy document_processing_chunks_select_member
on public.document_processing_chunks for select
to authenticated
using ((select private.is_organization_member(organization_id)));

revoke all on table
  public.document_processing_jobs,
  public.document_processing_pages,
  public.document_processing_chunks
from anon, authenticated;

grant select on table
  public.document_processing_jobs,
  public.document_processing_pages,
  public.document_processing_chunks
to authenticated;

grant select, insert, update, delete on table
  public.document_processing_jobs,
  public.document_processing_pages,
  public.document_processing_chunks
to service_role;

grant usage on type public.document_processing_status to authenticated, service_role;

create or replace function public.retry_document_processing(p_job_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.document_processing_jobs%rowtype;
  v_new_job_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Authentication required.';
  end if;

  select * into v_job
  from public.document_processing_jobs
  where id = p_job_id
  for update;

  if not found or not (select private.has_organization_role(
    v_job.organization_id,
    array['owner', 'admin', 'member']::public.organization_role[]
  )) then
    raise exception using
      errcode = '42501',
      message = 'Document processing job not found or not retryable.';
  end if;

  if v_job.status <> 'failed' then
    raise exception using
      errcode = '23514',
      message = 'Only failed document processing jobs can be retried.';
  end if;

  if v_job.attempt_number >= v_job.max_attempts then
    raise exception using
      errcode = '22023',
      message = 'Maximum document processing attempts reached.';
  end if;

  insert into public.document_processing_jobs (
    organization_id,
    evidence_document_id,
    tender_document_id,
    attempt_number,
    max_attempts,
    retry_of_job_id
  )
  values (
    v_job.organization_id,
    v_job.evidence_document_id,
    v_job.tender_document_id,
    v_job.attempt_number + 1,
    v_job.max_attempts,
    v_job.id
  )
  returning id into v_new_job_id;

  return v_new_job_id;
end;
$$;

revoke all on function public.retry_document_processing(uuid)
from public, anon, authenticated;
grant execute on function public.retry_document_processing(uuid) to authenticated;

comment on type public.document_processing_status is
  'Technical processing lifecycle only: queued, processing, completed, failed. It carries no compliance or award judgement.';
comment on table public.document_processing_jobs is
  'Immutable processing-attempt history for evidence and tender documents. Source inserts enqueue attempt one atomically.';
comment on table public.document_processing_pages is
  'Worker-generated extracted page text. M5 stores technical output only and does not represent requirements.';
comment on table public.document_processing_chunks is
  'Worker-generated page chunks reserved for later retrieval and citation features; no embeddings or AI conclusions are created in M5.';
comment on function public.retry_document_processing(uuid) is
  'Allows organization contributors to enqueue the next bounded attempt for a failed processing job.';

commit;
