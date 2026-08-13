# TenderAI architecture

## Product boundary

TenderAI is being built as an evidence-oriented tender operations platform for Italian and European business users. It supports human decision-making; it does not provide legal advice, make unsupported compliance decisions, or guarantee tender outcomes.

Future tender analysis must be evidence-first: important outputs should be attributable to source documents, relevant sections, matched company evidence, confidence, and time of analysis. M3 introduces only reusable company evidence documents; tender workspaces, requirement extraction, tasks, risks, and AI data remain deferred.

## Identity and tenant boundary

Supabase Auth owns credentials and sessions. `profiles` extends `auth.users` without duplicating authentication data. `organizations` is the tenant boundary, and `organization_members` is a many-to-many relationship: one user may belong to multiple workspaces with one constrained base role (`owner`, `admin`, `member`, or `viewer`) per organization.

Every future tenant-owned table must include `organization_id` and an organization-membership RLS policy. This supports multi-workspace and consulting use cases without assuming one user equals one company. Custom enterprise roles, SSO/SCIM, audit logs, and entitlements remain deferred.

## Authorization and RLS

RLS is enabled on all four exposed application tables. Users may read organizations and memberships only where they are members; profile visibility is limited to the user and colleagues sharing a workspace; invitations are visible only to owners/admins. Anonymous roles receive no table privileges.

Sensitive writes are not granted directly to authenticated clients. Narrow `SECURITY DEFINER` RPCs create organizations, create/accept/revoke invitations, change roles, and remove members. Each RPC derives identity from `auth.uid()`, validates the caller's current database role, uses an empty `search_path`, and has explicit execute grants. Private membership helpers avoid recursive RLS while retaining indexed lookups. A serialized trigger prevents removal or demotion of the last owner; M1 RPCs disallow owner mutation entirely until a dedicated transfer flow exists.

## Application shell and organization context

M2 uses organization-scoped routes under `/app/[organizationSlug]`. The route slug is navigation only: the server resolves the authenticated Supabase user, then reads the organization and membership using that request's RLS session. No client-side active-organization value grants access.

The organization layout loads only the authenticated tenant context and the user's permitted workspace list for the switcher. Team members and invitations are loaded only by `/team`. This keeps the app shell light and preserves RLS as the final authority. The shell currently exposes Overview, Tenders, Evidence Vault, Tasks, and Team. Tenders and Tasks remain intentionally honest empty-state routes until their respective milestones introduce reviewed data models and workflows.

## Company Evidence Vault

M3 adds `public.evidence_documents`, a reusable organization-owned compliance profile for company documents. Each record stores organization identity, uploader, title, optional description and dates, constrained category/status values, and immutable file identity/metadata. Composite indexes support organization-scoped listing and category/status filtering; an uploader foreign-key index supports deletion and audit checks.

The `evidence-documents` Storage bucket is created by migration as private, with a 10 MB limit and an allowlist for PDF, Word, Excel, JPEG, PNG, and WEBP files. Object paths are immutable and scoped as `{organization_id}/{document_id}/{safe_file_name}`. The database checks that each evidence record follows that exact path. Storage policies validate the bucket/path shape and use the existing membership roles: every member may read, owners/admins/members may upload, and owners/admins may remove storage objects. The application serves downloads with 60-second signed URLs generated on the server after an RLS-scoped document lookup. The Next.js request limits are set to 12 MB solely to accommodate a 10 MB multipart upload.

`evidence_documents` RLS allows all organization members to read; owners/admins/members may create and update permitted metadata; owners/admins may delete metadata. A database trigger prevents tenant/file identity changes and prevents members from archiving documents. The route slug remains navigation only: all queries and mutations resolve the authenticated organization context server-side, while RLS remains the database authority.

## Invitations

The application generates 256-bit random tokens and sends only a SHA-256 hash to PostgreSQL. Invitations are email-bound, expire after seven days, are single-use, and cannot assign `owner`. Admins may invite only members/viewers; owners may also invite admins. Acceptance locks the invitation row, verifies the authenticated account's confirmed email against `auth.users`, and atomically creates the membership for the invitation's organization.

Email delivery is not faked. M1 displays the raw invitation URL once for delivery through an approved channel; a transactional email provider can consume the same domain action later.

## Auth/session strategy

`@supabase/ssr` uses request-scoped browser/server clients. Next.js `proxy.ts` refreshes cookies with the current `getAll`/`setAll` contract, applies Supabase-provided no-cache headers, and validates signed claims before protected routes. Server actions use `getUser()` when they need a current authenticated user and never trust a client-supplied user ID. PKCE callback, email/password sign-up and sign-in, sign-out, and password recovery are implemented.

## Verification and limitations

`supabase/tests/database/m1_tenant_security.test.sql` covers the central cross-tenant and privilege-escalation invariants. It requires a local Supabase stack; it was not executable in the implementation environment because Docker was unavailable. Apply the migrations and run the documented database lint/test commands before deploying.

Ownership transfer, automated invitation email, MFA, SSO/SCIM, audit events, rate-limiting infrastructure, document versioning, malware scanning, content inspection, tender workspaces, document processing, AI extraction, reporting, and billing remain intentionally deferred. M3 exposes archival rather than destructive deletion in the application UI. It validates browser-reported file MIME type and Storage bucket policy; it does not yet perform server-side file-signature validation or automated expiry classification.
