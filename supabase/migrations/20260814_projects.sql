create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, instructions text not null default '', created_at timestamptz not null default now()
);
alter table public.conversations add column if not exists project_id uuid references public.projects(id) on delete set null;
alter table public.projects enable row level security;
create policy "users manage own projects" on public.projects for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
