# Core Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Orbital answers readable and make active conversations searchable, renameable, and archivable.

**Architecture:** Keep conversation ownership enforced by existing Supabase RLS plus API ownership checks. Add a small archive timestamp to conversations, return active conversations by default, and keep search as an instant client-side filter over the loaded active sessions. Use a trusted Markdown renderer for assistant-only content.

**Tech Stack:** React, TypeScript, FastAPI, Supabase/PostgREST, react-markdown, Vitest, pytest.

## Global Constraints

- Preserve WebSocket streaming and existing conversation deletion.
- Archive rather than delete for routine cleanup; delete remains confirmed and permanent.
- User content renders as plain text; only assistant messages render Markdown.
- All mutations validate the authenticated conversation owner.

---

### Task 1: Conversation lifecycle API

**Files:** `supabase/schema.sql`, `supabase/migrations/20260814_conversation_archive.sql`, `server/app/repositories/chat.py`, `server/app/api/chat.py`, `server/app/models/chat.py`, `server/tests/test_chat_api.py`

- [ ] Write failing tests for rename and archive ownership.
- [ ] Run the backend test file and confirm both routes are absent.
- [ ] Add `archived_at`, migration SQL, repository methods, request model, and protected routes.
- [ ] Re-run backend tests.

### Task 2: Conversation discovery controls

**Files:** `client/src/api/chat.ts`, `client/src/components/ChatApp.tsx`, `client/src/components/ChatApp.test.tsx`, `client/src/index.css`

- [ ] Write a failing component test for filtering a conversation by title and invoking rename/archive.
- [ ] Run the component test and confirm controls do not exist.
- [ ] Add the API methods, sidebar search, an accessible session action tray, rename dialog, and archive confirmation.
- [ ] Re-run frontend tests.

### Task 3: Assistant response presentation

**Files:** `client/package.json`, `client/package-lock.json`, `client/src/components/AssistantMessage.tsx`, `client/src/components/AssistantMessage.test.tsx`, `client/src/components/ChatApp.tsx`, `client/src/index.css`

- [ ] Write a failing render test for headings, lists, links, and code blocks.
- [ ] Run the test and confirm the component is absent.
- [ ] Add `react-markdown`, render assistant content through a dedicated component, and style semantic response elements.
- [ ] Run all tests and the production build.
