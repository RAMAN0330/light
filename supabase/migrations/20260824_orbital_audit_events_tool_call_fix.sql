-- record_tool_event (used by every gated tool call: repo browsing, CI, infra,
-- chat tool-calling) inserts audit_events directly from the user-scoped
-- client, unlike every other audit_events writer here which goes through a
-- `security definer` trigger and so never needed its own RLS policy. Without
-- an insert policy the row is rejected outright, and since it also omits
-- resource_id (a generic tool call has no single resource to point at), that
-- column needs to stop being mandatory too.
alter table public.audit_events alter column resource_id drop not null;

drop policy if exists "actors record tool call events" on public.audit_events;
create policy "actors record tool call events" on public.audit_events
  for insert with check (
    actor_id = (select auth.uid()) and (
      workspace_id is null or exists (
        select 1 from public.workspaces
        join public.organization_memberships on organization_memberships.organization_id = workspaces.organization_id
        where workspaces.id = audit_events.workspace_id
          and organization_memberships.user_id = (select auth.uid())
      )
    )
  );
