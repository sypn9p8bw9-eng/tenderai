# TenderAI

TenderAI is an Italian-first tender intelligence and compliance operations product. This repository currently contains its application foundation only; it does not yet implement authentication, a database schema, AI processing, or product workflows.

## Stack

- Next.js App Router with TypeScript
- Tailwind CSS and shadcn/ui
- Supabase SSR client boundary
- Zod for runtime environment validation

## Local development

1. Use Node.js 22 or later.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local` and fill the Supabase values when a project is available.
4. Run `npm run dev`, then open `http://localhost:3000`.

Useful checks:

```bash
npm run lint
npm run typecheck
npm run build
```

## Conventions

- Application routes live in `src/app`.
- Reusable UI components live in `src/components`; shadcn/ui components are in `src/components/ui`.
- Shared services and infrastructure helpers live in `src/lib`.
- Supabase clients are created through `src/lib/supabase`, never with credentials embedded in source.
- Keep organization authorization at the database layer with RLS when the schema is introduced; frontend checks are not an authorization boundary.

See [docs/architecture.md](docs/architecture.md) for the foundation decisions and the intentionally deferred work.
