-- Phase 3 governed email/calendar connector control plane. This table deliberately
-- contains consent metadata only: provider OAuth tokens stay outside Postgres.
create table if not exists public.external_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('gmail', 'outlook_email', 'google_calendar', 'outlook_calendar')),
  scopes jsonb not null check (jsonb_typeof(scopes) = 'array'),
  status text not null default 'pending_authorization' check (status in ('pending_authorization', 'active', 'revoked')),
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check ((status = 'revoked') = (revoked_at is not null))
);

create index if not exists external_connections_workspace_created_at
  on public.external_connections (workspace_id, created_at desc);

alter table public.external_connections enable row level security;

drop policy if exists "members read workspace external connections" on public.external_connections;
create policy "members read workspace external connections" on public.external_connections
  for select using (
    exists (
      select 1 from public.workspaces
      join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
      where workspaces.id = external_connections.workspace_id
        and organization_memberships.user_id = (select auth.uid())
    )
  );

drop policy if exists "workspace admins create external connections" on public.external_connections;
create policy "workspace admins create external connections" on public.external_connections
  for insert with check (
    created_by = (select auth.uid()) and exists (
      select 1 from public.workspaces
      join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
      where workspaces.id = external_connections.workspace_id
        and organization_memberships.user_id = (select auth.uid())
        and organization_memberships.role in ('owner', 'platform_admin', 'workspace_admin')
    )
  );

drop policy if exists "workspace admins revoke external connections" on public.external_connections;
create policy "workspace admins revoke external connections" on public.external_connections
  for update using (
    exists (
      select 1 from public.workspaces
      join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
      where workspaces.id = external_connections.workspace_id
        and organization_memberships.user_id = (select auth.uid())
        and organization_memberships.role in ('owner', 'platform_admin', 'workspace_admin')
    )
  );

create or replace function public.audit_external_connection_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_organization_id uuid;
begin
  select organization_id into event_organization_id from public.workspaces where id = new.workspace_id;
  insert into public.audit_events (organization_id, workspace_id, actor_id, action, resource_type, resource_id, details)
  values (
    event_organization_id,
    new.workspace_id,
    auth.uid(),
    'external_connection.' || case when tg_op = 'INSERT' then 'requested' else new.status end,
    'external_connection',
    new.id,
    jsonb_build_object('provider', new.provider, 'scopes', new.scopes, 'status', new.status)
  );
  return new;
end;
$$;

drop trigger if exists audit_external_connection_changed on public.external_connections;
create trigger audit_external_connection_changed
  after insert or update on public.external_connections
  for each row execute function public.audit_external_connection_changed();
-- Phase 1 (read-only visibility) of CI/CD pipeline handling and Docker/Kubernetes
-- infrastructure monitoring. Mutating infra actions are a later phase; this
-- migration only stores connection registrations and append-only run logs.
-- Live container/pod state is never persisted here — it is always fetched
-- live through infra_gateway (see server/app/services/infra_gateway.py).

create table if not exists public.ci_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('github_actions')),
  external_ref text not null check (char_length(external_ref) between 1 and 255),
  manifest jsonb not null default '{}'::jsonb,
  enabled boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (workspace_id, provider, external_ref)
);

create table if not exists public.pipeline_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ci_connection_id uuid not null references public.ci_connections(id) on delete cascade,
  external_run_id text not null,
  pipeline_name text not null,
  branch text,
  commit_sha text,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  triggered_by text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (ci_connection_id, external_run_id)
);

create table if not exists public.infra_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null check (kind in ('docker_host', 'k8s_cluster')),
  name text not null check (char_length(name) between 1 and 120),
  manifest jsonb not null default '{}'::jsonb,
  enabled boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (workspace_id, kind, name)
);

-- Audit/state record for a mutating infra action (phase 2). The table is
-- created now so phase 1's read-only endpoints and phase 2's gated mutation
-- endpoint share one schema; no code path writes to it in phase 1.
create table if not exists public.infra_action_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  infra_connection_id uuid not null references public.infra_connections(id) on delete cascade,
  action text not null,
  resource_type text not null check (resource_type in ('container', 'image', 'pod', 'deployment', 'cluster')),
  resource_ref text not null,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  requested_by uuid not null references auth.users(id),
  approval_request_id uuid references public.approval_requests(id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists pipeline_runs_workspace_created_at on public.pipeline_runs (workspace_id, created_at desc);
create index if not exists infra_action_runs_workspace_created_at on public.infra_action_runs (workspace_id, created_at desc);

alter table public.ci_connections enable row level security;
alter table public.pipeline_runs enable row level security;
alter table public.infra_connections enable row level security;
alter table public.infra_action_runs enable row level security;

drop policy if exists "members read ci connections" on public.ci_connections;
create policy "members read ci connections" on public.ci_connections for select using (
  exists (
    select 1 from public.workspaces
    join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
    where workspaces.id = ci_connections.workspace_id
      and organization_memberships.user_id = (select auth.uid())
  )
);

drop policy if exists "workspace admins create ci connections" on public.ci_connections;
create policy "workspace admins create ci connections" on public.ci_connections for insert with check (
  created_by = (select auth.uid()) and exists (
    select 1 from public.workspaces
    join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
    where workspaces.id = ci_connections.workspace_id
      and organization_memberships.user_id = (select auth.uid())
      and organization_memberships.role in ('owner', 'platform_admin', 'workspace_admin')
  )
);

drop policy if exists "members read pipeline runs" on public.pipeline_runs;
create policy "members read pipeline runs" on public.pipeline_runs for select using (
  exists (
    select 1 from public.workspaces
    join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
    where workspaces.id = pipeline_runs.workspace_id
      and organization_memberships.user_id = (select auth.uid())
  )
);

drop policy if exists "members read infra connections" on public.infra_connections;
create policy "members read infra connections" on public.infra_connections for select using (
  exists (
    select 1 from public.workspaces
    join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
    where workspaces.id = infra_connections.workspace_id
      and organization_memberships.user_id = (select auth.uid())
  )
);

drop policy if exists "workspace admins create infra connections" on public.infra_connections;
create policy "workspace admins create infra connections" on public.infra_connections for insert with check (
  created_by = (select auth.uid()) and exists (
    select 1 from public.workspaces
    join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
    where workspaces.id = infra_connections.workspace_id
      and organization_memberships.user_id = (select auth.uid())
      and organization_memberships.role in ('owner', 'platform_admin', 'workspace_admin')
  )
);

drop policy if exists "members read infra action runs" on public.infra_action_runs;
create policy "members read infra action runs" on public.infra_action_runs for select using (
  exists (
    select 1 from public.workspaces
    join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
    where workspaces.id = infra_action_runs.workspace_id
      and organization_memberships.user_id = (select auth.uid())
  )
);

create or replace function public.audit_ci_connection_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_organization_id uuid;
begin
  select organization_id into event_organization_id from public.workspaces where id = new.workspace_id;
  insert into public.audit_events (organization_id, workspace_id, actor_id, action, resource_type, resource_id, details)
  values (
    event_organization_id,
    new.workspace_id,
    auth.uid(),
    case when tg_op = 'INSERT' then 'ci_connection.created' else 'ci_connection.updated' end,
    'ci_connection',
    new.id,
    jsonb_build_object('provider', new.provider, 'external_ref', new.external_ref, 'enabled', new.enabled)
  );
  return new;
end;
$$;

drop trigger if exists audit_ci_connection_changed on public.ci_connections;
create trigger audit_ci_connection_changed
  after insert or update on public.ci_connections
  for each row execute function public.audit_ci_connection_changed();

create or replace function public.audit_infra_connection_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_organization_id uuid;
begin
  select organization_id into event_organization_id from public.workspaces where id = new.workspace_id;
  insert into public.audit_events (organization_id, workspace_id, actor_id, action, resource_type, resource_id, details)
  values (
    event_organization_id,
    new.workspace_id,
    auth.uid(),
    case when tg_op = 'INSERT' then 'infra_connection.created' else 'infra_connection.updated' end,
    'infra_connection',
    new.id,
    jsonb_build_object('kind', new.kind, 'name', new.name, 'enabled', new.enabled)
  );
  return new;
end;
$$;

drop trigger if exists audit_infra_connection_changed on public.infra_connections;
create trigger audit_infra_connection_changed
  after insert or update on public.infra_connections
  for each row execute function public.audit_infra_connection_changed();

-- Default policy seeds: nothing destructive is auto-allowed. Read/list actions
-- are seeded allow so phase 1 visibility works without an explicit policy row
-- per workspace; every workspace still gets its own row so it can be tightened
-- per-workspace without a code change. Seeded per existing workspace only —
-- new workspaces fall back to policy_decision's "require_approval" default,
-- which is deliberately conservative (fixed by an explicit policy insert on
-- workspace creation in a later phase if a friendlier default is wanted).
insert into public.policies (workspace_id, action, decision, enabled, created_by)
select w.id, action.name, 'allow', true, o.created_by
from public.workspaces w
join public.organizations o on o.id = w.organization_id
cross join (values
  ('infra.container.list'), ('infra.image.list'), ('infra.container.logs'),
  ('infra.pod.list'), ('infra.pod.logs'), ('infra.deployment.list'),
  ('pipeline.run.list')
) as action(name)
on conflict (workspace_id, action) do nothing;
-- Phase 3: CI pipeline triggering — the highest-blast-radius piece of this
-- feature (it can kick off a real deploy), built last and on top of the
-- already-validated read-only CI visibility (phase 1) and gated infra
-- mutations (phase 2).
--
-- ci_credentials mirrors provider_credentials exactly: RLS enabled with NO
-- client-facing select policy, so it is only ever read through the admin
-- (service-role) client from trusted backend code, never through a
-- workspace-member's session. A per-connection GitHub token with the
-- `workflow` scope is a materially bigger trust step than the deployment-
-- wide read-only poll token used for phase 1 visibility.
create table if not exists public.ci_credentials (
  id uuid primary key default gen_random_uuid(),
  ci_connection_id uuid not null unique references public.ci_connections(id) on delete cascade,
  encrypted_secret text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.ci_credentials enable row level security;

-- Audit/state record for one trigger attempt, structurally the CI sibling of
-- infra_action_runs (kept as a separate table rather than folding into it —
-- resource_type there is fixed to container/image/pod/deployment/cluster,
-- and a pipeline trigger is a distinct kind of gated action).
create table if not exists public.ci_trigger_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ci_connection_id uuid not null references public.ci_connections(id) on delete cascade,
  workflow_ref text not null check (char_length(workflow_ref) between 1 and 255),
  git_ref text not null default 'main',
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
  requested_by uuid not null references auth.users(id),
  approval_request_id uuid references public.approval_requests(id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ci_trigger_runs_workspace_created_at on public.ci_trigger_runs (workspace_id, created_at desc);

alter table public.ci_trigger_runs enable row level security;

drop policy if exists "members read ci trigger runs" on public.ci_trigger_runs;
create policy "members read ci trigger runs" on public.ci_trigger_runs for select using (
  exists (
    select 1 from public.workspaces
    join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
    where workspaces.id = ci_trigger_runs.workspace_id
      and organization_memberships.user_id = (select auth.uid())
  )
);

-- Nothing triggers a real pipeline run without explicit sign-off, for every
-- existing workspace, no exceptions.
insert into public.policies (workspace_id, action, decision, enabled, created_by)
select w.id, 'pipeline.run.trigger', 'require_approval', true, o.created_by
from public.workspaces w
join public.organizations o on o.id = w.organization_id
on conflict (workspace_id, action) do nothing;
alter table public.projects
  add column if not exists repository_connection_id uuid references public.ci_connections(id) on delete set null;

create index if not exists projects_repository_connection_id_idx
  on public.projects(repository_connection_id);
-- Repository browsing (Repositories nav + Codebase Intelligence), built on
-- the ci_connections/ci_credentials pair already in place for CI triggering
-- (20260819/20260821): one workspace<->GitHub-repo connection, one stored
-- token, three surfaces. No new tables — GitHub is the source of truth for
-- trees/commits/branches/PRs, fetched live and never cached in Postgres,
-- exactly like the phase-1 infra list/logs reads.
insert into public.policies (workspace_id, action, decision, enabled, created_by)
select w.id, action.name, 'allow', true, o.created_by
from public.workspaces w
join public.organizations o on o.id = w.organization_id
cross join (values
  ('repo.info.read'), ('repo.tree.read'), ('repo.file.read'),
  ('repo.commits.read'), ('repo.branches.read'), ('repo.pr.read'),
  ('repo.compare.read'), ('repo.contributors.read'), ('repo.tags.read')
) as action(name)
on conflict (workspace_id, action) do nothing;
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

-- Authorizing the GitHub external connection itself is allowed by default —
-- unlike the email/calendar providers this table also covers, linking a
-- GitHub identity to discover repos carries no inbox/calendar access, so it
-- doesn't need the same approval gate.
insert into public.policies (workspace_id, action, decision, enabled, created_by)
select w.id, 'external_connection.authorize.github', 'allow', true, o.created_by
from public.workspaces w
join public.organizations o on o.id = w.organization_id
on conflict (workspace_id, action) do nothing;
-- record_tool_event (used by every gated tool call: repo browsing, CI, infra,
-- chat tool-calling) inserts audit_events directly from the user-scoped
-- client, unlike every other audit_events writer here which goes through a
-- `security definer` trigger and so never needed its own RLS policy. Without
-- an insert policy the row is rejected outright, and since it also omits
-- resource_id (a generic tool call has no single resource to point at), that
-- column needs to stop being mandatory too.
alter table public.audit_events alter column resource_id drop not null;

drop policy if exists "actors record tool call events" on public.audit_events;
create policy "actors record tool call events" on public.audit_events
  for insert with check (
    actor_id = (select auth.uid()) and (
      workspace_id is null or exists (
        select 1 from public.workspaces
        join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
        where workspaces.id = audit_events.workspace_id
          and organization_memberships.user_id = (select auth.uid())
      )
    )
  );

-- One-time cleanup: normalize any ci_connections rows saved before the
-- server started stripping full GitHub URLs down to "owner/repo" (see
-- _normalize_repo_ref in server/app/api/organizations.py).
update public.ci_connections
set external_ref = regexp_replace(
  regexp_replace(external_ref, '^(https?://github\.com/|git@github\.com:)', ''),
  '(\.git)?/*$', ''
)
where external_ref ~ '^(https?://github\.com/|git@github\.com:)';
