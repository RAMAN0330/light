create table if not exists public.workspace_schedules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  cron_expression text not null,
  enabled boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.workspace_schedules
  add column if not exists next_run_at timestamptz not null default now();

create table if not exists public.schedule_executions (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.workspace_schedules(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null check (status in ('pending_approval', 'ready', 'blocked', 'dispatched', 'failed')),
  created_at timestamptz not null default now(),
  unique (schedule_id, scheduled_for)
);

create index if not exists workspace_schedules_due on public.workspace_schedules (next_run_at) where enabled;
create index if not exists schedule_executions_workspace_created on public.schedule_executions (workspace_id, created_at desc);

alter table public.schedule_executions enable row level security;
drop policy if exists "members read schedule executions" on public.schedule_executions;
create policy "members read schedule executions" on public.schedule_executions for select using (
  exists (
    select 1 from public.workspaces
    join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
    where workspaces.id = schedule_executions.workspace_id
      and organization_memberships.user_id = (select auth.uid())
  )
);
