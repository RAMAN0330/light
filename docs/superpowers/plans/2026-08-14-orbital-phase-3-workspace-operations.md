# Orbital Phase 3 Workspace Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver workspace-scoped tasks, notes, in-app notifications, and activity history.

**Architecture:** Extend the existing FastAPI/Supabase organization control plane with tenant-owned operations records and audit-triggered activity. Reuse existing workspace authorization and the React workspace controls.

**Tech Stack:** FastAPI, Pydantic, Supabase Postgres/RLS, React/Vite, pytest, Vitest.

### Task 1: Operations persistence and API

- [ ] Add additive task, note, notification SQL tables with workspace RLS and audit triggers.
- [ ] Write failing authorization/status/notification API tests.
- [ ] Implement repository and API contracts for tasks, notes, notifications, and activity.
- [ ] Run targeted and full backend tests.

### Task 2: Operations UI

- [ ] Write failing UI tests for workspace task and notification states.
- [ ] Add typed API contracts and an Operations dialog that lists tasks/notes and notifications.
- [ ] Run frontend tests and production build.

### Task 3: Release verification

- [ ] Run full backend/frontend verification and the UI detector.
- [ ] Update the delivery roadmap and release runbook with Phase 3 Slice 1 gates.
