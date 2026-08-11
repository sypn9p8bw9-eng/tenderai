# TenderAI M1 architecture

## Identity and tenant boundary

Supabase Auth owns credentials and sessions. `profiles` extends `auth.users` without duplicating authentication data. `organizations` is the tenant boundary, and `organization_members` is a many-to-many relationship: one user may belong to multiple workspaces with one constrained base role (`owner`, `admin`, `member`, or `viewer`) per organization.

Every future tenant-owned table must include `organization_id` and an organization-membership RLS policy. This supports multi-workspace and consulting use cases without assuming one user equals one company. Custom enterprise roles, SSO/SCIM, audit logs, and entitlements remain deferred.

## Authorization and RLS

RLS is enabled on all four exposed application tables. Users may read organizations and memberships only where they are members; profile visibility is limited to the user and colleagues sharing a workspace; invitations are visible only to owners/admins. Anonymous roles receive no table privileges.

Sensitive writes are not granted directly to authenticated clients. Narrow `SECURITY DEFINER` RPCs create organizations, create/accept/revoke invitations, change roles, and remove members. Each RPC derives identity from `auth.uid()`, validates the caller's current database role, uses an empty `search_path`, and has explicit execute grants. Private membership helpers avoid recursive RLS while retaining indexed lookups. A serialized trigger prevents removal or demotion of the last owner; M1 RPCs disallow owner mutation entirely until a dedicated transfer flow exists.

## Invitations

The application generates 256-bit random tokens and sends only a SHA-256 hash to PostgreSQL. Invitations are email-bound, expire after seven days, are single-use, and cannot assign `owner`. Admins may invite only members/viewers; owners may also invite admins. Acceptance locks the invitation row, verifies the authenticated account's confirmed email against `auth.users`, and atomically creates the membership for the invitation's organization.

Email delivery is not faked. M1 displays the raw invitation URL once for delivery through an approved channel; a transactional email provider can consume the same domain action later.

## Auth/session strategy

`@supabase/ssr` uses request-scoped browser/server clients. Next.js `proxy.ts` refreshes cookies with the current `getAll`/`setAll` contract, applies Supabase-provided no-cache headers, and validates signed claims before protected routes. Server actions use `getUser()` when they need a current authenticated user and never trust a client-supplied user ID. PKCE callback, email/password sign-up and sign-in, sign-out, and password recovery are implemented.

## Verification and limitations

`supabase/tests/database/m1_tenant_security.test.sql` covers the central cross-tenant and privilege-escalation invariants. It requires a local Supabase stack; it was not executable in the implementation environment because Docker was unavailable. Apply the migration and run the documented database lint/test commands before deploying.

M1 intentionally omits ownership transfer, automated invitation email, MFA, SSO/SCIM, audit events, rate-limiting infrastructure, and all tender/document/AI/billing features.
