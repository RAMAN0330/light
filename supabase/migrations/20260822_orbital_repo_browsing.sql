-- Repository browsing (Repositories nav + Codebase Intelligence), built on
-- the ci_connections/ci_credentials pair already in place for CI triggering
-- (20260819/20260821): one workspace<->GitHub-repo connection, one stored
-- token, three surfaces. No new tables — GitHub is the source of truth for
-- trees/commits/branches/PRs, fetched live and never cached in Postgres,
-- exactly like the phase-1 infra list/logs reads.
insert into public.policies (workspace_id, action, decision, enabled, created_by)
select w.id, action.name, 'allow', true, o.created_by
from public.workspaces w
join public.organizations o on o.id = w.organization_id
cross join (values
  ('repo.info.read'), ('repo.tree.read'), ('repo.file.read'),
  ('repo.commits.read'), ('repo.branches.read'), ('repo.pr.read'),
  ('repo.compare.read'), ('repo.contributors.read'), ('repo.tags.read')
) as action(name)
on conflict (workspace_id, action) do nothing;
