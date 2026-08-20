alter table public.agent_runs add column if not exists parent_run_id uuid references public.agent_runs(id) on delete set null;
alter table public.agent_runs add column if not exists scope text;
alter table public.agent_runs drop constraint if exists agent_runs_status_check;
alter table public.agent_runs add constraint agent_runs_status_check check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled'));
alter table public.artifacts add column if not exists agent_run_id uuid references public.agent_runs(id) on delete set null;
alter table public.artifacts add column if not exists scope jsonb not null default '{}'::jsonb;

create table if not exists public.workspace_retention_policies (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  retention_days integer not null check (retention_days between 1 and 3650), legal_hold boolean not null default false,
  updated_by uuid not null references auth.users(id) on delete restrict, updated_at timestamptz not null default now()
);
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  agent_run_id uuid references public.agent_runs(id) on delete set null, kind text not null check (kind in ('agent_run', 'storage', 'connector')),
  units integer not null check (units >= 0), created_at timestamptz not null default now()
);
create index if not exists agent_runs_parent_run_id on public.agent_runs (parent_run_id);
create index if not exists usage_events_workspace_created_at on public.usage_events (workspace_id, created_at desc);

alter table public.workspace_retention_policies enable row level security;
alter table public.usage_events enable row level security;
drop policy if exists "members read workspace retention policies" on public.workspace_retention_policies;
drop policy if exists "workspace admins manage retention policies" on public.workspace_retention_policies;
drop policy if exists "members read workspace usage" on public.usage_events;
drop policy if exists "workspace admins create delegated runs" on public.agent_runs;
create policy "members read workspace retention policies" on public.workspace_retention_policies for select using (exists (select 1 from public.workspaces join public.organization_memberships on organization_memberships.organization_id=workspaces.organization_id where workspaces.id=workspace_retention_policies.workspace_id and organization_memberships.user_id=(select auth.uid())));
create policy "workspace admins manage retention policies" on public.workspace_retention_policies for all using (exists (select 1 from public.workspaces join public.organization_memberships on organization_memberships.organization_id=workspaces.organization_id where workspaces.id=workspace_retention_policies.workspace_id and organization_memberships.user_id=(select auth.uid()) and organization_memberships.role in ('owner','platform_admin','workspace_admin'))) with check (exists (select 1 from public.workspaces join public.organization_memberships on organization_memberships.organization_id=workspaces.organization_id where workspaces.id=workspace_retention_policies.workspace_id and organization_memberships.user_id=(select auth.uid()) and organization_memberships.role in ('owner','platform_admin','workspace_admin')));
create policy "members read workspace usage" on public.usage_events for select using (exists (select 1 from public.workspaces join public.organization_memberships on organization_memberships.organization_id=workspaces.organization_id where workspaces.id=usage_events.workspace_id and organization_memberships.user_id=(select auth.uid())));
create policy "workspace admins create delegated runs" on public.agent_runs for insert with check (parent_run_id is not null and requested_by=(select auth.uid()) and exists (select 1 from public.workspaces join public.organization_memberships on organization_memberships.organization_id=workspaces.organization_id where workspaces.id=agent_runs.workspace_id and organization_memberships.user_id=(select auth.uid()) and organization_memberships.role in ('owner','platform_admin','workspace_admin')));
