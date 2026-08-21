-- Per-commit structural code analysis for connected repositories (the
-- "codebase intelligence" surface referenced in github_gateway.py's module
-- docstring). Read-only against GitHub, written only by the analysis poller
-- (app/workers/commit_analysis_sync.py) via the admin client, so this table
-- only needs a select policy for members — same shape as pipeline_runs.

create table if not exists public.commit_analyses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  ci_connection_id uuid not null references public.ci_connections(id) on delete cascade,
  commit_sha text not null,
  branch text,
  health_score int not null,
  grade text not null,
  issues jsonb not null default '[]'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (ci_connection_id, commit_sha)
);

create index if not exists commit_analyses_workspace_created_at on public.commit_analyses (workspace_id, created_at desc);
create index if not exists commit_analyses_connection_created_at on public.commit_analyses (ci_connection_id, created_at desc);

alter table public.commit_analyses enable row level security;

drop policy if exists "members read commit analyses" on public.commit_analyses;
create policy "members read commit analyses" on public.commit_analyses for select using (
  exists (
    select 1 from public.workspaces
    join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
    where workspaces.id = commit_analyses.workspace_id
      and organization_memberships.user_id = (select auth.uid())
  )
);
