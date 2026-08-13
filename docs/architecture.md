# TenderAI architecture

## Product boundary

TenderAI is being built as an evidence-oriented tender operations platform for Italian and European business users. It supports human decision-making; it does not provide legal advice, make unsupported compliance decisions, or guarantee tender outcomes.

Future tender analysis must be evidence-first: important outputs should be attributable to source documents, relevant sections, matched company evidence, confidence, and time of analysis. M4 introduces tender workspaces and their source documents only; requirement extraction, compliance decisions, tasks, risks, and AI data remain deferred.

## Identity and tenant boundary

Supabase Auth owns credentials and sessions. `profiles` extends `auth.users` without duplicating authentication data. `organizations` is the tenant boundary, and `organization_members` is a many-to-many relationship: one user may belong to multiple workspaces with one constrained base role (`owner`, `admin`, `member`, or `viewer`) per organization.

Every future tenant-owned table must include `organization_id` and an organization-membership RLS policy. This supports multi-workspace and consulting use cases without assuming one user equals one company. Custom enterprise roles, SSO/SCIM, audit logs, and entitlements remain deferred.

## Authorization and RLS

RLS is enabled on all four exposed application tables. Users may read organizations and memberships only where they are members; profile visibility is limited to the user and colleagues sharing a workspace; invitations are visible only to owners/admins. Anonymous roles receive no table privileges.

Sensitive writes are not granted directly to authenticated clients. Narrow `SECURITY DEFINER` RPCs create organizations, create/accept/revoke invitations, change roles, and remove members. Each RPC derives identity from `auth.uid()`, validates the caller's current database role, uses an empty `search_path`, and has explicit execute grants. Private membership helpers avoid recursive RLS while retaining indexed lookups. A serialized trigger prevents removal or demotion of the last owner; M1 RPCs disallow owner mutation entirely until a dedicated transfer flow exists.

## Application shell and organization context

M2 uses organization-scoped routes under `/app/[organizationSlug]`. The route slug is navigation only: the server resolves the authenticated Supabase user, then reads the organization and membership using that request's RLS session. No client-side active-organization value grants access.

The organization layout loads only the authenticated tenant context and the user's permitted workspace list for the switcher. Team members and invitations are loaded only by `/team`. This keeps the app shell light and preserves RLS as the final authority. The shell exposes Overview, Tenders, Evidence Vault, Tasks, and Team. Tenders is now a real workspace route; Tasks remains an intentionally honest empty-state route.

## Company Evidence Vault

M3 adds `public.evidence_documents`, a reusable organization-owned compliance profile for company documents. Each record stores organization identity, uploader, title, optional description and dates, constrained category/status values, and immutable file identity/metadata. Composite indexes support organization-scoped listing and category/status filtering; an uploader foreign-key index supports deletion and audit checks.

The `evidence-documents` Storage bucket is created by migration as private, with a 10 MB limit and an allowlist for PDF, Word, Excel, JPEG, PNG, and WEBP files. Object paths are immutable and scoped as `{organization_id}/{document_id}/{safe_file_name}`. The database checks that each evidence record follows that exact path. Storage policies validate the bucket/path shape and use the existing membership roles: every member may read, owners/admins/members may upload, and owners/admins may remove storage objects. The application serves downloads with 60-second signed URLs generated on the server after an RLS-scoped document lookup. The Next.js request limits are set to 27 MB to accommodate M4's 25 MB multipart document uploads; M3 remains constrained to 10 MB by its bucket and server validation.

`evidence_documents` RLS allows all organization members to read; owners/admins/members may create and update permitted metadata; owners/admins may delete metadata. A database trigger prevents tenant/file identity changes and prevents members from archiving documents. The route slug remains navigation only: all queries and mutations resolve the authenticated organization context server-side, while RLS remains the database authority.

## Tender Workspaces

M4 adds `public.tenders` and `public.tender_documents`. A tender belongs to exactly one organization and stores manual opportunity metadata: title, workflow status, procedure, buyer, CIG/CUP, estimated value, deadline, source URL, and internal notes. It deliberately stores no extracted requirements, compliance outcomes, legal assessment, bid/no-bid score, or AI output. `tender_documents` is an immutable source-document record scoped by both `organization_id` and `tender_id`; a composite foreign key requires those identifiers to match the parent tender.

Tender RLS gives all members read access; owners/admins/members may create and update non-archived metadata; only owners/admins can archive or delete. The integrity trigger keeps tenant/creator fields immutable, locks archived tenders, and assigns the archival timestamp. Document records are readable by members and insertable only by owners/admins/members for an active tender. Viewers are read-only throughout.

The migration provisions a private `tender-documents` bucket with a 25 MB limit and the reviewed PDF, Office, and image MIME types. Object paths are immutable and shaped as `{organization_id}/{tender_id}/{document_id}/{safe_file_name}`. The Storage RLS helper is `SECURITY INVOKER`, validates bucket, path, and live tender ownership, then delegates membership authorization to the existing private helper; this preserves the authenticated `auth.uid()` context. Storage reads are limited to tenant members, uploads to owners/admins/members for active tenders, and deletion to owners/admins. Server actions generate 60-second signed download URLs only after an RLS-scoped tender-document lookup.

## Invitations

The application generates 256-bit random tokens and sends only a SHA-256 hash to PostgreSQL. Invitations are email-bound, expire after seven days, are single-use, and cannot assign `owner`. Admins may invite only members/viewers; owners may also invite admins. Acceptance locks the invitation row, verifies the authenticated account's confirmed email against `auth.users`, and atomically creates the membership for the invitation's organization.

Email delivery is not faked. M1 displays the raw invitation URL once for delivery through an approved channel; a transactional email provider can consume the same domain action later.

## Auth/session strategy

`@supabase/ssr` uses request-scoped browser/server clients. Next.js `proxy.ts` refreshes cookies with the current `getAll`/`setAll` contract, applies Supabase-provided no-cache headers, and validates signed claims before protected routes. Server actions use `getUser()` when they need a current authenticated user and never trust a client-supplied user ID. PKCE callback, email/password sign-up and sign-in, sign-out, and password recovery are implemented.

## Verification and limitations

`supabase/tests/database/m1_tenant_security.test.sql` covers the central cross-tenant and privilege-escalation invariants. It requires a local Supabase stack; it was not executable in the implementation environment because Docker was unavailable. Apply the migrations and run the documented database lint/test commands before deploying.

Ownership transfer, automated invitation email, MFA, SSO/SCIM, audit events, rate-limiting infrastructure, document versioning, malware scanning, content inspection, tender document parsing, requirement extraction, compliance matrices, bid/no-bid scoring, AI extraction, reporting, and billing remain intentionally deferred. M3 and M4 validate browser-reported file MIME type and Storage bucket policy; they do not yet perform server-side file-signature validation. M4 exposes archival rather than destructive deletion in the application UI.
