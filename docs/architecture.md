# TenderAI foundation architecture

## Scope

This is a deliberately small application foundation. It establishes a typed Next.js application, a shared UI system, and secure Supabase integration boundaries. Authentication, tables, RLS policies, document storage, AI/RAG, billing, and all product workflows are explicitly deferred.

## Structure

```text
src/
  app/                 Next.js routes and global styling
  components/ui/       shadcn/ui components
  lib/                 infrastructure and cross-cutting helpers
    supabase/          browser and request-scoped Supabase factories
```

## Key decisions

- **App Router + TypeScript:** Server-first routing with strict TypeScript and a separate `typecheck` command.
- **Tailwind + shadcn/ui:** shadcn is initialized with its current Base Nova preset. Components are added only when a product workflow needs them.
- **Supabase boundary:** `src/lib/supabase/client.ts` and `server.ts` are the only initial client factories. They accept only browser-safe configuration and validate it lazily with Zod. No service-role credential is configured or exposed.
- **Future tenancy:** Every organization-owned table will carry `organization_id`; membership-derived Row Level Security will be the authoritative isolation control. Server actions and route handlers must also verify intent, but frontend authorization is never sufficient.
- **Future documents and AI:** Private object storage, asynchronous processing, page/chunk provenance, and provider interfaces will be introduced with the document-ingestion milestone. Generated findings must retain source evidence before being presented as conclusions.

## Operational guardrails for the next milestone

- Add Supabase schema changes through reviewed migrations; enable RLS on each exposed table and add policies with explicit ownership/membership predicates.
- Keep storage buckets private and authorize `storage.objects` operations through RLS before enabling uploads.
- Add the Supabase session-refresh proxy only alongside authentication; authenticated routes must not be statically cached.
- Add job processing and provider-specific AI code only when the ingestion workflow is being built.
