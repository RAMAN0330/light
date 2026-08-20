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
