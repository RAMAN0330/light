# Orbital Phase 2 Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver private workspace artifacts, cited retrieval and reports, controlled Phase 2 adapters, and review-only skill observations.

**Architecture:** FastAPI authorizes private Supabase Storage access and writes workspace-owned metadata to Postgres. A small synchronous normalization/retrieval service supports text/Markdown immediately, while upstream integrations are represented by disabled adapter records until independently security-reviewed.

**Tech Stack:** React/Vite/TypeScript, FastAPI/Pydantic, Supabase Postgres/Storage, pytest, Vitest.

## Global Constraints

- Reuse Supabase Storage and Postgres; do not add a queue or vector database in Phase 2.
- Every data operation must verify workspace authorization and write tenant-scoped metadata.
- Browser clients never choose object keys or receive server secrets.
- Add a failing test before every production behavior change.
- Keep Graphify, Graft, Headroom, Agent Reach, and anydoc adapter execution disabled; register metadata only.

---

### Task 1: Artifact schema and authorization repository

**Files:**
- Modify: `supabase/schema.sql`, `supabase/migrations/20260814_orbital_foundation.sql`
- Modify: `server/app/repositories/organizations.py`
- Test: `server/tests/test_organizations_api.py`

**Interfaces:**
- Produces `create_artifact`, `list_artifacts`, `artifact`, `set_artifact_normalized`, and `workspace_for_artifact` repository methods.
- Depends on existing `owns_workspace` and `can_manage_workspace` checks.

- [ ] Write failing API tests for cross-workspace artifact access and metadata-only artifact listing.
- [ ] Run the targeted pytest file and confirm the new test fails because artifact routes do not exist.
- [ ] Add additive artifact/collection/chunk/report/adapter/observation tables, indexes, RLS policies, and audit triggers.
- [ ] Add minimal repository methods required by artifact routes.
- [ ] Run targeted pytest and confirm it passes.

### Task 2: Private upload, normalization, and download contracts

**Files:**
- Create: `server/app/services/knowledge.py`
- Modify: `server/app/models/chat.py`, `server/app/api/organizations.py`, `server/app/main.py`
- Test: `server/tests/test_organizations_api.py`, `server/tests/test_knowledge.py`

**Interfaces:**
- Produces `normalize_text(content: str) -> list[dict]` and artifact upload/list/normalize/download endpoints.
- Consumes an admin Supabase Storage client and Task 1 artifact repository methods.

- [ ] Write failing tests for text normalization offsets, rejected binary content, and authorization before signed download.
- [ ] Run targeted tests and confirm each fails for the absent service/routes.
- [ ] Implement bounded text/Markdown normalization and artifact routes with generated private keys and signed URLs.
- [ ] Run targeted tests and confirm they pass.

### Task 3: Collections, cited retrieval, and report artifacts

**Files:**
- Modify: `server/app/services/knowledge.py`, `server/app/models/chat.py`, `server/app/api/organizations.py`, `server/app/repositories/organizations.py`
- Test: `server/tests/test_knowledge.py`, `server/tests/test_organizations_api.py`

**Interfaces:**
- Produces collection creation/membership/query and report creation endpoints.
- `search_chunks(query, chunks, limit)` returns excerpts with artifact IDs and exact character offsets.

- [ ] Write failing tests for workspace-isolated retrieval, citation offsets, and rejecting a report citation outside the workspace.
- [ ] Run targeted tests and confirm they fail.
- [ ] Implement deterministic token-overlap scoring, bounded chunks, collection routes, and cited Markdown report persistence.
- [ ] Run targeted tests and confirm they pass.

### Task 4: Disabled adapters and draft-only observations

**Files:**
- Modify: `server/app/models/chat.py`, `server/app/api/organizations.py`, `server/app/repositories/organizations.py`
- Test: `server/tests/test_organizations_api.py`

**Interfaces:**
- Produces adapter registration and skill-observation create/accept endpoints.
- Accepting an observation calls existing `create_skill` with a draft status only.

- [ ] Write failing tests for disabled-by-default adapters and an accepted observation creating a draft rather than publishing.
- [ ] Run targeted tests and confirm they fail.
- [ ] Implement validation, admin authorization, adapter registration, observation creation, and draft-only acceptance.
- [ ] Run targeted tests and confirm they pass.

### Task 5: Knowledge UI and release documentation

**Files:**
- Modify: `client/src/api/chat.ts`, `client/src/components/ChatApp.tsx`, `client/src/components/ChatApp.test.tsx`, `client/src/index.css`
- Modify: `README.md`, `docs/orbital/06-delivery-roadmap.md`, `docs/orbital/07-phase-1-release-runbook.md`

**Interfaces:**
- Consumes artifact, collection, query, and report APIs from Tasks 2–3.
- Produces an accessible workspace Knowledge dialog with loading, empty, failure, and cited-result states.

- [ ] Write failing UI tests for loading the active workspace’s knowledge and rendering a cited result.
- [ ] Run the focused Vitest file and confirm it fails.
- [ ] Implement the minimal API client and dialog; reuse existing modal/button styles.
- [ ] Run focused and full frontend tests, then production build.
- [ ] Update Phase 2 rollout/documentation requirements and run the full backend suite.

## Verification

- [ ] `cd server && .venv/bin/python -m compileall -q app && .venv/bin/python -m pytest -q`
- [ ] `cd client && npm test -- --run && npm run build`
- [ ] Run the Impeccable detector for the changed frontend targets.
- [ ] Confirm the Storage bucket is private and migration is applied in staging before enabling uploads.
