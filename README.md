# TenderAI

TenderAI is an Italian-first, evidence-oriented tender operations platform for bid teams, technical offices, procurement teams, SMEs, and consultants. Its purpose is to help teams assess opportunities, prepare evidence, coordinate work, and reduce avoidable compliance risk.

TenderAI provides decision support, not legal advice or a guarantee of tender outcomes. Important future conclusions are designed to remain traceable to source material and subject to human review.

M3 adds the Company Evidence Vault: a private, organization-scoped archive for reusable company documents such as certifications, declarations, insurance records, references, and technical evidence. Tender data, document processing, AI, billing, and dashboards with operational metrics remain intentionally deferred.

## Stack

- Next.js 16 App Router, React 19, and strict TypeScript
- Tailwind CSS and shadcn/ui
- Supabase Auth, PostgreSQL, and Row Level Security
- Zod validation for user input and environment configuration

## Local development

1. Use Node.js 22 or later and install dependencies with `npm install`.
2. Install the Supabase CLI and Docker Desktop.
3. Copy `.env.example` to `.env.local`.
4. Run `supabase start`, then copy its local URL and publishable key into `.env.local`.
5. Run `npm run dev` and open `http://localhost:3000`.

Quality checks:

```bash
npm run lint
npm run typecheck
npm run build
supabase db reset
supabase db lint --local --level warning
supabase test db supabase/tests/database --local
```

## Hosted Supabase setup

1. Link the intended project and apply the reviewed migrations with `supabase db push`.
2. Configure the Auth site URL and allowed redirect URLs for the deployed application, including `/auth/callback`.
3. Keep email confirmations enabled and configure production SMTP before launch.
4. Set the three public variables from `.env.example` in the deployment environment. Never add a service-role key to the browser environment.

The M3 migration provisions the private `evidence-documents` Storage bucket, limits uploads to 10 MB and the reviewed PDF/Office/image MIME types, and creates its RLS policies. After applying migrations, verify in the Supabase Storage dashboard that this bucket remains private. Do not make it public or add broad `storage.objects` policies.

Invitation delivery is intentionally provider-neutral: an owner/admin creates a one-time link and sends it through an approved channel. The raw token is displayed once; only its SHA-256 hash is stored.

See [docs/architecture.md](docs/architecture.md) for the tenant, authorization, and application-shell model.
