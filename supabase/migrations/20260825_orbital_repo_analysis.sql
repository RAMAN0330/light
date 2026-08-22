-- Deep repository analysis (clone + graphify structural extraction for the
-- Codebase Intelligence tab), built on the same ci_connections/ci_credentials
-- pair as repo.*.read (20260822). Meaningfully higher-risk than those reads:
-- it clones the full repository tree rather than proxying single GitHub API
-- calls, so repo.analysis.run defaults to require_approval for every
-- workspace, same as db.schema.read (20260824).
insert into public.policies (workspace_id, action, decision, enabled, created_by)
select w.id, 'repo.analysis.run', 'require_approval', true, o.created_by
from public.workspaces w
join public.organizations o on o.id = w.organization_id
on conflict (workspace_id, action) do nothing;
