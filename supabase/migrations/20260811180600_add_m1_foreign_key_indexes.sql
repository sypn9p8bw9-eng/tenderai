begin;

create index if not exists organizations_created_by_idx
  on public.organizations (created_by);

create index if not exists organization_members_invited_by_idx
  on public.organization_members (invited_by);

create index if not exists organization_invitations_invited_by_idx
  on public.organization_invitations (invited_by);

create index if not exists organization_invitations_accepted_by_idx
  on public.organization_invitations (accepted_by);

comment on index public.organizations_created_by_idx is
  'Supports foreign key checks and owner/audit lookups for organizations.created_by.';

comment on index public.organization_members_invited_by_idx is
  'Supports foreign key checks and invitation/audit lookups for organization_members.invited_by.';

comment on index public.organization_invitations_invited_by_idx is
  'Supports foreign key checks and invitation manager audit lookups.';

comment on index public.organization_invitations_accepted_by_idx is
  'Supports foreign key checks and accepted invitation audit lookups.';

commit;
