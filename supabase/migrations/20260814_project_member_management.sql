drop policy if exists "members view memberships" on public.project_members;
create policy "project participants view memberships" on public.project_members for select using (
  user_id = (select auth.uid()) or exists (select 1 from public.projects where id = project_id and user_id = (select auth.uid()))
);
