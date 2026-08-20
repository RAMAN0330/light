# Orbital Phase 3 Schedules Design

Schedules are workspace-scoped in-app automation records. Each stores a title, cron expression, optional skill reference, next-run time, enabled state, and captured policy/skill versions. Creation, pause/resume, listing, and inspection are implemented now. Executions remain disabled until a durable worker/queue deployment is configured; this prevents unattended side effects. Existing policy and approval checks remain mandatory before any future run.

`workspace_schedules` uses workspace RLS and audit events. Only workspace administrators create or toggle schedules; members can read them. The API exposes `GET|POST /workspaces/{workspace_id}/schedules` and `PATCH /schedules/{schedule_id}`. The UI is added under Operations after the backend contract is tested.
