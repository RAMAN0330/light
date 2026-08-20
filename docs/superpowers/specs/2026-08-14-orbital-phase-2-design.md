# Orbital Phase 2 Intelligence Design

## Goal

Deliver tenant-governed workspace intelligence: private files, normalized source material, cited retrieval and reports, plus opt-in intelligence adapters and review-only skill observations.

## Scope and sequencing

Phase 2 is delivered as four independently usable slices, in order:

1. Artifact pipeline: private Supabase Storage originals, workspace-scoped artifact metadata, normalization, status/failure handling, download authorization, and audit events.
2. Knowledge: collections, retained chunks with offsets, deterministic retrieval, source citations, and Markdown research report artifacts.
3. Optional adapters: Graphify snapshots, Headroom/Agent Reach registration contracts, and Graft uploaded local graph artifacts. Each remains disabled by default and policy-controlled.
4. Skill catalog: catalog view plus observation recommendations stored as drafts; only a reviewer can publish or roll back a version.

## Architecture

FastAPI remains the sole application access path for Storage operations. Originals are written to private workspace paths, never public buckets. PostgreSQL metadata records the organization/workspace IDs, owner, content hash, storage key, MIME type, status, normalized artifact relationship, and conversion failure reason. Existing workspace membership and administration checks apply before every artifact, collection, retrieval, report, adapter, or recommendation action.

The first release is deliberately synchronous and uses no separate vector database or queue. Text and Markdown are normalized in-process; Office/PDF conversion is represented by a small `anydoc` adapter boundary that returns an explicit unavailable/failed outcome without dropping the original. Chunk scoring is deterministic token overlap within a workspace collection. This makes citations reproducible and retains source offsets. A dedicated worker/vector index may replace these internals later without changing API contracts.

## Data model

- `artifacts`: workspace-owned original or generated objects, status (`uploaded`, `normalized`, `failed`), content hash, storage key, MIME type, source artifact ID, failure reason, and creator.
- `knowledge_collections`: workspace-owned named collections.
- `collection_artifacts`: collection/artifact membership.
- `knowledge_chunks`: normalized text, ordinal, character offsets, and artifact ID. Chunks are only created for normalized text.
- `research_reports`: workspace-owned report title/content plus a generated report artifact and source citation IDs.
- `adapter_registrations`: adapter name, workspace, enabled state, manifest, and created-by. This generalizes the existing controlled connector design without invoking an upstream tool automatically.
- `skill_observations`: workspace-owned recommendation title, proposed skill manifest, provenance, status (`draft`, `dismissed`, `accepted`), and creator. Acceptance creates a draft skill only; it never publishes.

All tables reference a workspace and use RLS policies equivalent to other workspace data. Metadata and state transitions write organization audit events through database triggers.

## API contracts

- `POST /workspaces/{workspace_id}/artifacts`: upload a text/Markdown file via multipart, create a private object and artifact metadata.
- `GET /workspaces/{workspace_id}/artifacts`: list workspace artifact metadata.
- `GET /artifacts/{artifact_id}/download`: verify workspace membership then return a short-lived signed Storage URL.
- `POST /artifacts/{artifact_id}/normalize`: normalize text/Markdown and create chunks; unsupported input is marked failed with a retained original.
- `POST /workspaces/{workspace_id}/collections` and `POST /collections/{collection_id}/artifacts`: create a collection and add normalized artifacts.
- `POST /collections/{collection_id}/query`: return scored excerpts with artifact name and exact offsets.
- `POST /workspaces/{workspace_id}/research-reports`: save a cited Markdown report and generated artifact. Every citation must belong to the workspace.
- `POST /workspaces/{workspace_id}/adapters`: admin-only registration; the adapter is disabled by default. Headroom, Agent Reach, Graphify, and Graft are allowed names.
- `POST /workspaces/{workspace_id}/skill-observations`: admin/reviewer-created recommendation draft; `POST /skill-observations/{id}/accept` creates a draft skill after manifest validation.

## Security and governance

- Object names are generated server-side under `{organization_id}/{workspace_id}/{artifact_id}`; client paths are never accepted.
- The bucket is private; artifact download signing happens only after workspace authorization.
- File size and supported text/Markdown MIME types are enforced at the API boundary. Unsupported formats are retained only if upload succeeds and report a normalization failure; no parser execution occurs for untrusted binaries in this release.
- Retrieval is workspace-scoped, bounded by query and result size, and returns citations rather than untraceable context.
- Adapter records require workspace administration, default to disabled, and use the Phase 1 policy/approval route before any future invocation. This release does not ship automatic external HTTP, browser, shell, or local configuration writes.
- Skill observations cannot mutate an existing skill or create a published skill. The accepted result starts in `draft` and follows the Phase 1 review lifecycle.

## UX

The active workspace gains a Knowledge control. It lists artifact status, offers a file upload, lets users create a collection, run a cited search, and save a report. Citations show source name and excerpt. Error states state whether upload, normalization, or authorization failed. Governance continues to own adapter and skill-review actions; no adapter appears enabled without an explicit admin action.

## Testing and release criteria

Tests cover cross-workspace artifact/list/download/query/report attempts, metadata that does not leak storage paths or content, unsupported normalization retaining an explicit failure, exact citation offsets, report citation ownership, disabled adapter registration, and observation acceptance creating a draft only. API and UI tests cover loading, empty, failure, and accessible interaction states.

Release requires the private Supabase Storage bucket to exist, RLS/migration application in staging, configured file-size limits, and the existing Phase 1 authorization/audit suite to remain green. Graphify, Headroom, Agent Reach, Graft, and anydoc require separate upstream security/license validation before their executable adapters are enabled.
