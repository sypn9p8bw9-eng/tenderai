# TenderAI

TenderAI is an Italian-first tender intelligence and compliance operations product. M1 provides the authenticated, multi-tenant foundation only; tender, document, AI, billing, and dashboard functionality remain deferred.

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

1. Link the intended project and apply the reviewed migration with `supabase db push`.
2. Configure the Auth site URL and allowed redirect URLs for the deployed application, including `/auth/callback`.
3. Keep email confirmations enabled and configure production SMTP before launch.
4. Set the three public variables from `.env.example` in the deployment environment. Never add a service-role key to the browser environment.

Invitation delivery is intentionally provider-neutral in M1: an owner/admin creates a one-time link and sends it through an approved channel. The raw token is displayed once; only its SHA-256 hash is stored.

See [docs/architecture.md](docs/architecture.md) for the tenant and security model.
