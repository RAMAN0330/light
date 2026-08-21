alter table public.projects
  add column if not exists repository_connection_id uuid references public.ci_connections(id) on delete set null;

create index if not exists projects_repository_connection_id_idx
  on public.projects(repository_connection_id);
