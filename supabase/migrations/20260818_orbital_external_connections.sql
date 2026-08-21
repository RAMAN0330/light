-- Phase 3 governed email/calendar connector control plane. This table deliberately
-- contains consent metadata only: provider OAuth tokens stay outside Postgres.
create table if not exists public.external_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null check (provider in ('gmail', 'outlook_email', 'google_calendar', 'outlook_calendar')),
  scopes jsonb not null check (jsonb_typeof(scopes) = 'array'),
  status text not null default 'pending_authorization' check (status in ('pending_authorization', 'active', 'revoked')),
  revoked_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check ((status = 'revoked') = (revoked_at is not null))
);

create index if not exists external_connections_workspace_created_at
  on public.external_connections (workspace_id, created_at desc);

alter table public.external_connections enable row level security;

drop policy if exists "members read workspace external connections" on public.external_connections;
create policy "members read workspace external connections" on public.external_connections
  for select using (
    exists (
      select 1 from public.workspaces
      join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
      where workspaces.id = external_connections.workspace_id
        and organization_memberships.user_id = (select auth.uid())
    )
  );

drop policy if exists "workspace admins create external connections" on public.external_connections;
create policy "workspace admins create external connections" on public.external_connections
  for insert with check (
    created_by = (select auth.uid()) and exists (
      select 1 from public.workspaces
      join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
      where workspaces.id = external_connections.workspace_id
        and organization_memberships.user_id = (select auth.uid())
        and organization_memberships.role in ('owner', 'platform_admin', 'workspace_admin')
    )
  );

drop policy if exists "workspace admins revoke external connections" on public.external_connections;
create policy "workspace admins revoke external connections" on public.external_connections
  for update using (
    exists (
      select 1 from public.workspaces
      join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
      where workspaces.id = external_connections.workspace_id
        and organization_memberships.user_id = (select auth.uid())
        and organization_memberships.role in ('owner', 'platform_admin', 'workspace_admin')
    )
  );

create or replace function public.audit_external_connection_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_organization_id uuid;
begin
  select organization_id into event_organization_id from public.workspaces where id = new.workspace_id;
  insert into public.audit_events (organization_id, workspace_id, actor_id, action, resource_type, resource_id, details)
  values (
    event_organization_id,
    new.workspace_id,
    auth.uid(),
    'external_connection.' || case when tg_op = 'INSERT' then 'requested' else new.status end,
    'external_connection',
    new.id,
    jsonb_build_object('provider', new.provider, 'scopes', new.scopes, 'status', new.status)
  );
  return new;
end;
$$;

drop trigger if exists audit_external_connection_changed on public.external_connections;
create trigger audit_external_connection_changed
  after insert or update on public.external_connections
  for each row execute function public.audit_external_connection_changed();
