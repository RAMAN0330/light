-- Orbital Phase 3 Slice 1: apply after the intelligence migration.
create table if not exists public.workspace_tasks (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, title text not null, description text not null default '', status text not null default 'open' check(status in ('open','in_progress','done','cancelled')), assignee_id uuid references auth.users(id), created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.workspace_notes (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, title text not null, content text not null, created_by uuid not null references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.in_app_notifications (id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade, user_id uuid not null references auth.users(id), title text not null, body text not null default '', read_at timestamptz, created_at timestamptz not null default now());
create index if not exists workspace_tasks_workspace_created on public.workspace_tasks(workspace_id, created_at desc);
create index if not exists workspace_notes_workspace_created on public.workspace_notes(workspace_id, created_at desc);
create index if not exists in_app_notifications_user_created on public.in_app_notifications(user_id, created_at desc);
alter table public.workspace_tasks enable row level security;
alter table public.workspace_notes enable row level security;
alter table public.in_app_notifications enable row level security;
drop policy if exists "members manage workspace tasks" on public.workspace_tasks;
drop policy if exists "members manage workspace notes" on public.workspace_notes;
drop policy if exists "users read their notifications" on public.in_app_notifications;
drop policy if exists "users update their notifications" on public.in_app_notifications;
create policy "members manage workspace tasks" on public.workspace_tasks for all using (exists (select 1 from public.workspaces join public.organization_memberships on organization_memberships.organization_id=workspaces.organization_id where workspaces.id=workspace_tasks.workspace_id and organization_memberships.user_id=(select auth.uid()))) with check (created_by=(select auth.uid()));
create policy "members manage workspace notes" on public.workspace_notes for all using (exists (select 1 from public.workspaces join public.organization_memberships on organization_memberships.organization_id=workspaces.organization_id where workspaces.id=workspace_notes.workspace_id and organization_memberships.user_id=(select auth.uid()))) with check (created_by=(select auth.uid()));
create policy "users read their notifications" on public.in_app_notifications for select using (user_id=(select auth.uid()));
create policy "users update their notifications" on public.in_app_notifications for update using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
