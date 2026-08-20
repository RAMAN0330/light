create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('editor','viewer')),
  primary key (project_id, user_id)
);
alter table public.project_members enable row level security;
create policy "members view memberships" on public.project_members for select using (user_id = (select auth.uid()));
create policy "project owners manage memberships" on public.project_members for all using (exists (select 1 from public.projects where id = project_id and user_id = (select auth.uid()))) with check (exists (select 1 from public.projects where id = project_id and user_id = (select auth.uid())));
