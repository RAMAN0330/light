-- GitHub OAuth: lets a workspace member link their personal GitHub identity
-- to discover repos to register (powers a "browse my repos" picker), while
-- the actual governed repo connection stays the existing workspace-scoped
-- ci_connections/ci_credentials — OAuth here is a discovery convenience, not
-- a new governance bypass. Reuses the existing external_connections consent
-- row (provider/scopes/status) rather than inventing a parallel table.
alter table public.external_connections drop constraint if exists external_connections_provider_check;
alter table public.external_connections add constraint external_connections_provider_check
  check (provider in ('gmail', 'outlook_email', 'google_calendar', 'outlook_calendar', 'github'));

-- The actual OAuth access token. Same shape as ci_credentials/provider_credentials:
-- RLS enabled with NO client-facing select policy — only ever read through the
-- admin (service-role) client, and only ever decrypted at the moment of use.
create table if not exists public.external_connection_credentials (
  id uuid primary key default gen_random_uuid(),
  external_connection_id uuid not null unique references public.external_connections(id) on delete cascade,
  encrypted_secret text not null,
  created_at timestamptz not null default now()
);

alter table public.external_connection_credentials enable row level security;

-- Listing the repos a linked GitHub identity can see is a read, not a
-- governance-relevant mutation on workspace resources — allowed by default,
-- same posture as the repo.*.read actions.
insert into public.policies (workspace_id, action, decision, enabled, created_by)
select w.id, 'github_connection.repos.read', 'allow', true, o.created_by
from public.workspaces w
join public.organizations o on o.id = w.organization_id
on conflict (workspace_id, action) do nothing;
