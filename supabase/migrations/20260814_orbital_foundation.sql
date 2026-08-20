create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'platform_admin', 'workspace_admin', 'member', 'viewer', 'auditor')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  requested_by uuid not null references auth.users(id) on delete restrict,
  action text not null check (char_length(action) between 1 and 120),
  summary text not null check (char_length(summary) between 1 and 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'pending' and decided_by is null and decided_at is null) or (status in ('approved', 'denied') and decided_by is not null and decided_at is not null))
);

create table if not exists public.provider_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  provider text not null check (provider in ('openrouter')),
  encrypted_secret text not null,
  model text not null check (char_length(model) between 1 and 200),
  created_by uuid not null references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.skills (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  version text not null check (char_length(version) between 1 and 64),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'published', 'retired')),
  manifest jsonb not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (workspace_id, name, version)
);

create table if not exists public.connectors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  transport text not null default 'mcp' check (transport = 'mcp'),
  endpoint text not null check (char_length(endpoint) between 1 and 2048),
  manifest jsonb not null,
  enabled boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  mode text not null check (mode in ('ask', 'research', 'create')),
  status text not null check (status in ('running', 'succeeded', 'failed', 'cancelled')),
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.policies (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  action text not null check (char_length(action) between 1 and 120),
  decision text not null check (decision in ('allow', 'require_approval', 'deny')),
  enabled boolean not null default true,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (workspace_id, action)
);

create table if not exists public.custom_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  permissions jsonb not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.custom_role_assignments (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.custom_roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index if not exists organization_memberships_user_id on public.organization_memberships (user_id);
create index if not exists workspaces_organization_id on public.workspaces (organization_id);
create index if not exists audit_events_organization_created_at on public.audit_events (organization_id, created_at desc);
create index if not exists approval_requests_workspace_created_at on public.approval_requests (workspace_id, created_at desc);
create index if not exists skills_workspace_created_at on public.skills (workspace_id, created_at desc);
create index if not exists connectors_workspace_created_at on public.connectors (workspace_id, created_at desc);
create index if not exists agent_runs_workspace_created_at on public.agent_runs (workspace_id, created_at desc);
create index if not exists policies_workspace_action on public.policies (workspace_id, action);
create index if not exists custom_role_assignments_user_id on public.custom_role_assignments (user_id);

alter table public.conversations
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;
create index if not exists conversations_workspace_id on public.conversations (workspace_id);

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.workspaces enable row level security;
alter table public.audit_events enable row level security;
alter table public.approval_requests enable row level security;
alter table public.provider_credentials enable row level security;
alter table public.skills enable row level security;
alter table public.connectors enable row level security;
alter table public.agent_runs enable row level security;
alter table public.policies enable row level security;
alter table public.custom_roles enable row level security;
alter table public.custom_role_assignments enable row level security;

drop policy if exists "users create their organizations" on public.organizations;
drop policy if exists "members read their organizations" on public.organizations;
drop policy if exists "members read organization memberships" on public.organization_memberships;
drop policy if exists "creators add their owner membership" on public.organization_memberships;
drop policy if exists "members read workspaces" on public.workspaces;
drop policy if exists "owners create workspaces" on public.workspaces;
drop policy if exists "members read organization audit events" on public.audit_events;
drop policy if exists "members read workspace approvals" on public.approval_requests;
drop policy if exists "members request workspace approvals" on public.approval_requests;
drop policy if exists "admins decide workspace approvals" on public.approval_requests;
drop policy if exists "admins read provider credential metadata" on public.provider_credentials;
drop policy if exists "members read workspace skills" on public.skills;
drop policy if exists "workspace admins create skills" on public.skills;
drop policy if exists "workspace admins update skills" on public.skills;
drop policy if exists "members read workspace connectors" on public.connectors;
drop policy if exists "workspace admins create connectors" on public.connectors;
drop policy if exists "workspace admins update connectors" on public.connectors;
drop policy if exists "members read agent runs" on public.agent_runs;
drop policy if exists "users create their agent runs" on public.agent_runs;
drop policy if exists "users update their agent runs" on public.agent_runs;
drop policy if exists "members read workspace policies" on public.policies;
drop policy if exists "workspace admins manage policies" on public.policies;
drop policy if exists "members read custom roles" on public.custom_roles;
drop policy if exists "organization admins manage custom roles" on public.custom_roles;
drop policy if exists "members read their custom role assignment" on public.custom_role_assignments;
drop policy if exists "organization admins manage custom role assignments" on public.custom_role_assignments;

create policy "users create their organizations" on public.organizations
  for insert with check ((select auth.uid()) = created_by);
create policy "members read their organizations" on public.organizations
  for select using (exists (
    select 1 from public.organization_memberships
    where organization_id = organizations.id and user_id = (select auth.uid())
  ));

create policy "members read organization memberships" on public.organization_memberships
  for select using ((select auth.uid()) = user_id);
create policy "creators add their owner membership" on public.organization_memberships
  for insert with check (
    user_id = (select auth.uid()) and exists (
      select 1 from public.organizations
      where id = organization_id and created_by = (select auth.uid())
    )
  );

create policy "members read workspaces" on public.workspaces
  for select using (exists (
    select 1 from public.organization_memberships
    where organization_id = workspaces.organization_id and user_id = (select auth.uid())
  ));
create policy "owners create workspaces" on public.workspaces
  for insert with check (exists (
    select 1 from public.organization_memberships
    where organization_id = workspaces.organization_id
      and user_id = (select auth.uid())
      and role in ('owner', 'platform_admin', 'workspace_admin')
  ));

create policy "members read organization audit events" on public.audit_events
  for select using (exists (
    select 1 from public.organization_memberships
    where organization_id = audit_events.organization_id and user_id = (select auth.uid())
  ));

create policy "members read workspace approvals" on public.approval_requests
  for select using (exists (
    select 1 from public.workspaces join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
    where workspaces.id = approval_requests.workspace_id and organization_memberships.user_id = (select auth.uid())
  ));
create policy "members request workspace approvals" on public.approval_requests
  for insert with check (
    requested_by = (select auth.uid()) and exists (
      select 1 from public.workspaces join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
      where workspaces.id = approval_requests.workspace_id and organization_memberships.user_id = (select auth.uid())
    )
  );
create policy "admins decide workspace approvals" on public.approval_requests
  for update using (exists (
    select 1 from public.workspaces join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
    where workspaces.id = approval_requests.workspace_id and organization_memberships.user_id = (select auth.uid())
      and organization_memberships.role in ('owner', 'platform_admin', 'workspace_admin')
  )) with check (exists (
    select 1 from public.workspaces join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
    where workspaces.id = approval_requests.workspace_id and organization_memberships.user_id = (select auth.uid())
      and organization_memberships.role in ('owner', 'platform_admin', 'workspace_admin')
  ));
create policy "members read workspace skills" on public.skills
  for select using (exists (
    select 1 from public.workspaces join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
    where workspaces.id = skills.workspace_id and organization_memberships.user_id = (select auth.uid())
  ));
create policy "workspace admins create skills" on public.skills
  for insert with check (
    created_by = (select auth.uid()) and exists (
      select 1 from public.workspaces join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
      where workspaces.id = skills.workspace_id and organization_memberships.user_id = (select auth.uid())
        and organization_memberships.role in ('owner', 'platform_admin', 'workspace_admin')
    )
  );
create policy "workspace admins update skills" on public.skills
  for update using (exists (
    select 1 from public.workspaces join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
    where workspaces.id = skills.workspace_id and organization_memberships.user_id = (select auth.uid())
      and organization_memberships.role in ('owner', 'platform_admin', 'workspace_admin')
  )) with check (exists (
    select 1 from public.workspaces join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
    where workspaces.id = skills.workspace_id and organization_memberships.user_id = (select auth.uid())
      and organization_memberships.role in ('owner', 'platform_admin', 'workspace_admin')
  ));

create policy "members read workspace connectors" on public.connectors
  for select using (exists (
    select 1 from public.workspaces join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
    where workspaces.id = connectors.workspace_id and organization_memberships.user_id = (select auth.uid())
  ));
create policy "workspace admins create connectors" on public.connectors
  for insert with check (
    created_by = (select auth.uid()) and exists (
      select 1 from public.workspaces join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
      where workspaces.id = connectors.workspace_id and organization_memberships.user_id = (select auth.uid())
        and organization_memberships.role in ('owner', 'platform_admin', 'workspace_admin')
    )
  );
create policy "workspace admins update connectors" on public.connectors
  for update using (exists (
    select 1 from public.workspaces join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
    where workspaces.id = connectors.workspace_id and organization_memberships.user_id = (select auth.uid())
      and organization_memberships.role in ('owner', 'platform_admin', 'workspace_admin')
  )) with check (exists (
    select 1 from public.workspaces join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
    where workspaces.id = connectors.workspace_id and organization_memberships.user_id = (select auth.uid())
      and organization_memberships.role in ('owner', 'platform_admin', 'workspace_admin')
  ));

create policy "members read agent runs" on public.agent_runs
  for select using (
    requested_by = (select auth.uid()) or exists (
      select 1 from public.workspaces join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
      where workspaces.id = agent_runs.workspace_id and organization_memberships.user_id = (select auth.uid())
    )
  );
create policy "users create their agent runs" on public.agent_runs
  for insert with check (
    requested_by = (select auth.uid()) and exists (
      select 1 from public.conversations
      where conversations.id = agent_runs.conversation_id and conversations.user_id = (select auth.uid())
    )
  );
create policy "users update their agent runs" on public.agent_runs
  for update using (requested_by = (select auth.uid())) with check (requested_by = (select auth.uid()));

create policy "members read workspace policies" on public.policies
  for select using (exists (
    select 1 from public.workspaces join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
    where workspaces.id = policies.workspace_id and organization_memberships.user_id = (select auth.uid())
  ));
create policy "workspace admins manage policies" on public.policies
  for all using (exists (
    select 1 from public.workspaces join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
    where workspaces.id = policies.workspace_id and organization_memberships.user_id = (select auth.uid())
      and organization_memberships.role in ('owner', 'platform_admin', 'workspace_admin')
  )) with check (exists (
    select 1 from public.workspaces join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
    where workspaces.id = policies.workspace_id and organization_memberships.user_id = (select auth.uid())
      and organization_memberships.role in ('owner', 'platform_admin', 'workspace_admin')
  ));

create policy "members read custom roles" on public.custom_roles
  for select using (exists (
    select 1 from public.organization_memberships
    where organization_id = custom_roles.organization_id and user_id = (select auth.uid())
  ));
create policy "organization admins manage custom roles" on public.custom_roles
  for all using (exists (
    select 1 from public.organization_memberships
    where organization_id = custom_roles.organization_id and user_id = (select auth.uid())
      and role in ('owner', 'platform_admin')
  )) with check (exists (
    select 1 from public.organization_memberships
    where organization_id = custom_roles.organization_id and user_id = (select auth.uid())
      and role in ('owner', 'platform_admin')
  ));
create policy "members read their custom role assignment" on public.custom_role_assignments
  for select using (user_id = (select auth.uid()));
create policy "organization admins manage custom role assignments" on public.custom_role_assignments
  for all using (exists (
    select 1 from public.organization_memberships
    where organization_id = custom_role_assignments.organization_id and user_id = (select auth.uid())
      and role in ('owner', 'platform_admin')
  )) with check (exists (
    select 1 from public.organization_memberships
    where organization_id = custom_role_assignments.organization_id and user_id = (select auth.uid())
      and role in ('owner', 'platform_admin')
  ));

create or replace function public.audit_organization_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_events (organization_id, actor_id, action, resource_type, resource_id, details)
  values (new.id, new.created_by, 'organization.created', 'organization', new.id, jsonb_build_object('name', new.name));
  return new;
end;
$$;

create or replace function public.audit_workspace_created()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_events (organization_id, workspace_id, actor_id, action, resource_type, resource_id, details)
  values (new.organization_id, new.id, auth.uid(), 'workspace.created', 'workspace', new.id, jsonb_build_object('name', new.name));
  return new;
end;
$$;

create or replace function public.audit_membership_changed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  event_organization_id uuid;
  event_user_id uuid;
  event_role text;
begin
  if tg_op = 'DELETE' then
    event_organization_id := old.organization_id;
    event_user_id := old.user_id;
    event_role := old.role;
  else
    event_organization_id := new.organization_id;
    event_user_id := new.user_id;
    event_role := new.role;
  end if;
  insert into public.audit_events (organization_id, actor_id, action, resource_type, resource_id, details)
  values (event_organization_id, auth.uid(), 'membership.' || lower(tg_op), 'organization_membership', event_user_id, jsonb_build_object('role', event_role));
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.audit_approval_changed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  event_action text;
  event_organization_id uuid;
begin
  select organization_id into event_organization_id from public.workspaces where id = new.workspace_id;
  event_action := case when tg_op = 'INSERT' then 'approval.requested' else 'approval.' || new.status end;
  insert into public.audit_events (organization_id, workspace_id, actor_id, action, resource_type, resource_id, details)
  values (event_organization_id, new.workspace_id, auth.uid(), event_action, 'approval_request', new.id, jsonb_build_object('requested_by', new.requested_by));
  return new;
end;
$$;

create or replace function public.audit_skill_changed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  event_organization_id uuid;
begin
  select organization_id into event_organization_id from public.workspaces where id = new.workspace_id;
  insert into public.audit_events (organization_id, workspace_id, actor_id, action, resource_type, resource_id, details)
  values (event_organization_id, new.workspace_id, auth.uid(), 'skill.' || case when tg_op = 'INSERT' then 'created' else new.status end, 'skill', new.id, jsonb_build_object('name', new.name, 'version', new.version, 'status', new.status));
  return new;
end;
$$;

create or replace function public.enforce_skill_immutability()
returns trigger language plpgsql as $$
begin
  if old.status = 'published' and (new.name is distinct from old.name or new.version is distinct from old.version or new.manifest is distinct from old.manifest) then
    raise exception 'Published skill versions are immutable';
  end if;
  if (old.status = 'draft' and new.status not in ('draft', 'in_review'))
    or (old.status = 'in_review' and new.status not in ('in_review', 'published'))
    or (old.status = 'published' and new.status not in ('published', 'retired'))
    or (old.status = 'retired' and new.status <> 'retired') then
    raise exception 'Invalid skill lifecycle transition';
  end if;
  return new;
end;
$$;

create or replace function public.audit_connector_changed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  event_organization_id uuid;
begin
  select organization_id into event_organization_id from public.workspaces where id = new.workspace_id;
  insert into public.audit_events (organization_id, workspace_id, actor_id, action, resource_type, resource_id, details)
  values (event_organization_id, new.workspace_id, auth.uid(), case when tg_op = 'INSERT' then 'connector.created' else 'connector.' || case when new.enabled then 'enabled' else 'disabled' end end, 'connector', new.id, jsonb_build_object('name', new.name, 'transport', new.transport, 'enabled', new.enabled));
  return new;
end;
$$;

create or replace function public.audit_agent_run_changed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  event_organization_id uuid;
begin
  if new.workspace_id is null then
    return new;
  end if;
  select organization_id into event_organization_id from public.workspaces where id = new.workspace_id;
  insert into public.audit_events (organization_id, workspace_id, actor_id, action, resource_type, resource_id, details)
  values (event_organization_id, new.workspace_id, new.requested_by, 'agent_run.' || case when tg_op = 'INSERT' then 'started' else new.status end, 'agent_run', new.id, jsonb_build_object('conversation_id', new.conversation_id, 'mode', new.mode, 'error', new.error));
  return new;
end;
$$;

create or replace function public.audit_policy_changed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  event_organization_id uuid;
begin
  select organization_id into event_organization_id from public.workspaces where id = new.workspace_id;
  insert into public.audit_events (organization_id, workspace_id, actor_id, action, resource_type, resource_id, details)
  values (event_organization_id, new.workspace_id, auth.uid(), 'policy.' || lower(tg_op), 'policy', new.id, jsonb_build_object('action', new.action, 'decision', new.decision, 'enabled', new.enabled));
  return new;
end;
$$;

create or replace function public.audit_custom_role_changed()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  event_organization_id uuid;
  event_role_id uuid;
begin
  if tg_table_name = 'custom_roles' then
    event_organization_id := new.organization_id;
    event_role_id := new.id;
  else
    event_organization_id := new.organization_id;
    event_role_id := new.role_id;
  end if;
  insert into public.audit_events (organization_id, actor_id, action, resource_type, resource_id, details)
  values (event_organization_id, auth.uid(), 'custom_role.' || lower(tg_op), tg_table_name, event_role_id, jsonb_build_object('user_id', case when tg_table_name = 'custom_role_assignments' then new.user_id else null end));
  return new;
end;
$$;

drop trigger if exists audit_organization_created on public.organizations;
create trigger audit_organization_created after insert on public.organizations
  for each row execute function public.audit_organization_created();
drop trigger if exists audit_workspace_created on public.workspaces;
create trigger audit_workspace_created after insert on public.workspaces
  for each row execute function public.audit_workspace_created();
drop trigger if exists audit_membership_changed on public.organization_memberships;
create trigger audit_membership_changed after insert or update or delete on public.organization_memberships
  for each row execute function public.audit_membership_changed();
drop trigger if exists audit_approval_changed on public.approval_requests;
create trigger audit_approval_changed after insert or update on public.approval_requests
  for each row execute function public.audit_approval_changed();
drop trigger if exists audit_skill_created on public.skills;
drop trigger if exists audit_skill_changed on public.skills;
create trigger audit_skill_changed after insert or update on public.skills
  for each row execute function public.audit_skill_changed();
drop trigger if exists enforce_skill_immutability on public.skills;
create trigger enforce_skill_immutability before update on public.skills
  for each row execute function public.enforce_skill_immutability();
drop trigger if exists audit_connector_created on public.connectors;
drop trigger if exists audit_connector_changed on public.connectors;
create trigger audit_connector_changed after insert or update on public.connectors
  for each row execute function public.audit_connector_changed();
drop trigger if exists audit_agent_run_changed on public.agent_runs;
create trigger audit_agent_run_changed after insert or update on public.agent_runs
  for each row execute function public.audit_agent_run_changed();
drop trigger if exists audit_policy_changed on public.policies;
create trigger audit_policy_changed after insert or update on public.policies
  for each row execute function public.audit_policy_changed();
drop trigger if exists audit_custom_role_changed on public.custom_roles;
create trigger audit_custom_role_changed after insert or update on public.custom_roles
  for each row execute function public.audit_custom_role_changed();
drop trigger if exists audit_custom_role_assignment_changed on public.custom_role_assignments;
create trigger audit_custom_role_assignment_changed after insert or update on public.custom_role_assignments
  for each row execute function public.audit_custom_role_changed();
