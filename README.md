# TenderAI

TenderAI is an Italian-first, evidence-oriented tender operations platform for bid teams, technical offices, procurement teams, SMEs, and consultants. Its purpose is to help teams assess opportunities, prepare evidence, coordinate work, and reduce avoidable compliance risk.

TenderAI provides decision support, not legal advice or a guarantee of tender outcomes. Important future conclusions are designed to remain traceable to source material and subject to human review.

M5 provides a tenant-scoped document-processing queue. M6 adds deterministic text extraction for digital PDFs. M7 adds server-only, model-tagged embeddings and organization-scoped semantic source retrieval. This retrieval layer does not generate answers, requirements, compliance decisions, or bid/no-bid scores.

## Stack

- Next.js 16 App Router, React 19, and strict TypeScript
- Tailwind CSS and shadcn/ui
- Supabase Auth, PostgreSQL, and Row Level Security
- pgvector for tenant-scoped semantic source retrieval
- Zod validation for user input and environment configuration

## Local development

1. Use Node.js 22.13 or later and install dependencies with `npm install`.
2. Install the Supabase CLI and Docker Desktop.
3. Copy `.env.example` to `.env.local`.
4. Run `supabase start`, then copy its local URL and publishable key into `.env.local`.
5. Run `npm run dev` and open `http://localhost:3000`.

Quality checks:

```bash
npm run lint
npm run typecheck
npm run test:unit
npm run build
supabase db reset
supabase db lint --local --level warning
supabase test db supabase/tests/database --local
```

## Document extraction worker

Apply the M6 migration, then set `SUPABASE_SERVICE_ROLE_KEY` only in the trusted worker environment. Process one queued job locally with:

```bash
npm run worker:documents
```

Use `npm run worker:documents -- --max=10` to process up to ten queued jobs in one bounded run. The command reads `.env.local` when present. The service-role key must never use a `NEXT_PUBLIC_` prefix, be committed, or be provided to browser code.

M6 supports `application/pdf` files with extractable digital text. Image-only or scanned PDFs fail with `NO_EXTRACTABLE_TEXT` because OCR is intentionally deferred. Other MIME types fail with `UNSUPPORTED_MIME_TYPE`.

## Embedding worker and retrieval smoke test

Apply the M7 migration and configure the server-only `OPENAI_API_KEY`. The default model is `text-embedding-3-small`; override it with `EMBEDDING_MODEL` only when the model supports the database contract of 1,536 output dimensions.

Generate embeddings for up to 32 extracted chunks:

```bash
npm run worker:embeddings
```

Use `npm run worker:embeddings -- --max=100` for a bounded batch of up to 100 chunks. Claims are model-specific and idempotent; failed or abandoned claims can be retried up to the database limit.

Run a server-only retrieval smoke test after embeddings exist:

```bash
npm run retrieval:smoke -- --organization=<organization-uuid> --query="certificazione ISO 9001" --source=all --top-k=5
```

The source filter accepts `all`, `evidence`, or `tender`. The command prints matching source chunks and provenance only. It does not generate an AI answer. Both commands read `.env.local` when present and require `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, and optionally `EMBEDDING_MODEL` in their trusted runtime.

## Hosted Supabase setup

1. Link the intended project and apply the reviewed migrations with `supabase db push`.
2. Configure the Auth site URL and allowed redirect URLs for the deployed application, including `/auth/callback`.
3. Keep email confirmations enabled and configure production SMTP before launch.
4. Set the three public variables from `.env.example` in the web deployment environment.
5. Configure `SUPABASE_SERVICE_ROLE_KEY` and `OPENAI_API_KEY` only in the separate trusted worker runtime. Never expose either value to the browser environment.

The M3 and M4 migrations provision the private `evidence-documents` (10 MB) and `tender-documents` (25 MB) Storage buckets. Both accept the reviewed PDF/Office/image MIME types and use organization-scoped RLS policies. Tender document paths also include the tender ID. After applying migrations, verify in the Supabase Storage dashboard that both buckets remain private. Do not make either bucket public or add broad `storage.objects` policies. M6 uses the server-side service role to read these private objects; it validates each stored organization/document path before download.

Invitation delivery is intentionally provider-neutral: an owner/admin creates a one-time link and sends it through an approved channel. The raw token is displayed once; only its SHA-256 hash is stored.

See [docs/architecture.md](docs/architecture.md) for the tenant, authorization, and application-shell model.
