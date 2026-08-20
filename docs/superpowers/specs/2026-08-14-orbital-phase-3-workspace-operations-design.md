# Orbital Phase 3 Workspace Operations Design

## Goal

Add workspace-scoped tasks, notes, project/artifact links, activity history, and in-app notifications without external connectors or background scheduling.

## Scope

- Tasks have title, optional description, status (`open`, `in_progress`, `done`, `cancelled`), assignee, project reference, artifact reference, creator, and timestamps.
- Notes have title, content, optional project/artifact references, creator, and timestamps.
- Members can read workspace tasks/notes. Creators can edit their own records; workspace admins can manage all records.
- Assignment and status changes create in-app notification records for the assignee and append audit events.
- A workspace activity feed combines task/note changes from the audit event stream.

## Explicit non-goals

- No schedules, email, calendar, external OAuth, push delivery, background worker, or delegated execution in this slice.
- No rich-text collaboration or concurrent editing protocol; notes are plain Markdown text.

## Architecture

FastAPI exposes workspace-scoped task, note, notification, and activity endpoints. Supabase Postgres stores records with RLS tied to existing organization/workspace membership. Database triggers write audit events for task and note mutations; the API creates a notification for an assignee when a task is created or reassigned. The React workspace shell adds Operations navigation with task and note lists plus in-app notification count.

## API contracts

- `GET|POST /workspaces/{workspace_id}/tasks`
- `PATCH /tasks/{task_id}`
- `GET|POST /workspaces/{workspace_id}/notes`
- `PATCH /notes/{note_id}`
- `GET /workspaces/{workspace_id}/notifications`
- `POST /notifications/{notification_id}/read`
- `GET /workspaces/{workspace_id}/activity`

## Security and testing

Every endpoint verifies workspace access before reading or writing. Cross-workspace task/note/notification attempts return not found. Artifact and project links must belong to the same workspace or authenticated owner before being stored. Tests cover role behavior, assignment notifications, audit feed access, state validation, and read-state transitions.
