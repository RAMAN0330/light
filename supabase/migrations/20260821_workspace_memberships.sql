create table if not exists public.workspace_memberships (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('member', 'viewer')) default 'member',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

alter table public.workspace_memberships enable row level security;

drop policy if exists "workspace members read their membership" on public.workspace_memberships;
create policy "workspace members read their membership" on public.workspace_memberships
  for select using (user_id = (select auth.uid()));

drop policy if exists "workspace members read assigned workspace" on public.workspaces;
create policy "workspace members read assigned workspace" on public.workspaces
  for select using (exists (
    select 1 from public.workspace_memberships
    where workspace_memberships.workspace_id = workspaces.id
      and workspace_memberships.user_id = (select auth.uid())
  ));
