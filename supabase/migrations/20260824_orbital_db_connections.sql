-- Live database connections (Postgres/MySQL/MongoDB schema introspection for
-- DatabaseVisualizer). A meaningfully higher-risk category than repo
-- browsing: it stores real database credentials and has the backend connect
-- out to a customer-specified host, so db.schema.read defaults to
-- require_approval (not allow) for every workspace, unlike the repo.*.read
-- actions.
create table if not exists public.db_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  kind text not null check (kind in ('postgres', 'mysql', 'mongodb')),
  name text not null check (char_length(name) between 1 and 120),
  host text not null check (char_length(host) between 1 and 255),
  port int not null check (port between 1 and 65535),
  database_name text not null check (char_length(database_name) between 1 and 255),
  username text not null check (char_length(username) between 1 and 255),
  ssl boolean not null default false,
  enabled boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (workspace_id, kind, host, port, database_name)
);

-- Same shape as ci_credentials/external_connection_credentials: RLS enabled
-- with NO client-facing select policy — the password is only ever read
-- through the admin (service-role) client, decrypted at the moment of use.
create table if not exists public.db_connection_credentials (
  id uuid primary key default gen_random_uuid(),
  db_connection_id uuid not null unique references public.db_connections(id) on delete cascade,
  encrypted_secret text not null,
  created_at timestamptz not null default now()
);

alter table public.db_connections enable row level security;
alter table public.db_connection_credentials enable row level security;

drop policy if exists "members read db connections" on public.db_connections;
create policy "members read db connections" on public.db_connections for select using (
  exists (
    select 1 from public.workspaces
    join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
    where workspaces.id = db_connections.workspace_id
      and organization_memberships.user_id = (select auth.uid())
  )
);

insert into public.policies (workspace_id, action, decision, enabled, created_by)
select w.id, 'db.schema.read', 'require_approval', true, o.created_by
from public.workspaces w
join public.organizations o on o.id = w.organization_id
on conflict (workspace_id, action) do nothing;
