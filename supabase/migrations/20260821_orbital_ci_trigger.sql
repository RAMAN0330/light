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
