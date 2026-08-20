-- Phase 2: gated mutating infra actions (container/pod start/stop/restart/
-- delete, deployment scale). Builds on infra_action_runs from
-- 20260819_orbital_cicd_infra.sql; that table already carries the audit/
-- state shape this phase needs, it just gains a place to remember
-- action-specific parameters (e.g. a deployment's target replica count)
-- across the approve/deny round trip.

alter table public.infra_action_runs
  add column if not exists params jsonb not null default '{}'::jsonb;

-- Nothing destructive is auto-allowed: every mutating action defaults to
-- require_approval for every existing workspace. An explicit policy row
-- change (audited, like everything else in `policies`) is required to
-- loosen this — never a code change.
insert into public.policies (workspace_id, action, decision, enabled, created_by)
select w.id, action.name, 'require_approval', true, o.created_by
from public.workspaces w
join public.organizations o on o.id = w.organization_id
cross join (values
  ('infra.container.start'), ('infra.container.stop'),
  ('infra.container.restart'), ('infra.container.delete'),
  ('infra.pod.delete'), ('infra.deployment.scale')
) as action(name)
on conflict (workspace_id, action) do nothing;
