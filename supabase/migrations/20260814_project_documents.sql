create table if not exists public.project_documents (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade, name text not null, content text not null,
  created_at timestamptz not null default now()
);
alter table public.project_documents enable row level security;
create policy "users manage own project documents" on public.project_documents for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
