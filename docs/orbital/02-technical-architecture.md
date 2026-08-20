# Orbital Technical Architecture

## Architecture principles

- **Policy before execution:** no tool, retrieval, artifact or connector operation bypasses a server-side authorization decision.
- **Tenant isolation by construction:** organization and workspace identifiers are mandatory in storage, service and audit boundaries.
- **Adapters, not forks:** upstream integrations implement Orbital contracts and run outside the control plane.
- **Provenance over opaque output:** artifacts retain run, model, prompt policy, source and connector references.
- **Portable deployment:** the public API, authorization policy and event contracts are invariant between Cloud and Self-Hosted modes.

## System topology

```text
React web client
  └─ API gateway (FastAPI, REST + SSE)
      ├─ Identity and organization service
      ├─ Conversation and agent-run service
      ├─ Policy decision/enforcement service
      ├─ Skills and connector registry
      ├─ Knowledge and artifact service
      ├─ Provider gateway and encrypted-secret service
      ├─ Scheduler and notification service
      └─ Audit and usage service
          ├─ PostgreSQL/Supabase: transactional, tenant-scoped metadata
          ├─ Object storage: encrypted originals and artifacts
          ├─ Queue/workers: ingestion, retrieval, agent steps and schedules
          ├─ Search/graph indexes: workspace-scoped, rebuildable
          └─ Sandboxes/adapters: MCP, CLI, library and approved HTTP connectors
```

The existing Vite React client and FastAPI server remain the entry layer. Supabase is retained initially for Auth and PostgreSQL; service-owned repositories enforce active organization/workspace context in addition to database row-level security. Background workers are introduced before long-running ingestion, tool execution or schedules are enabled.

## Core data model

| Entity | Required fields | Notes |
|---|---|---|
| Organization | `id`, `name`, `deployment_mode`, `status` | Tenant boundary. |
| Workspace | `id`, `organization_id`, `name`, `policy_set_id` | Collaboration and data boundary. |
| Membership / Role | `principal_id`, `scope`, `role_id`, `grants` | Supports built-in and custom RBAC grants. |
| Policy | `scope`, `subject`, `resource`, `action`, `effect`, `conditions`, `version` | Default deny; evaluated per action. |
| Connector | `workspace_id`, `manifest`, `state`, `credential_ref`, `approval_class` | Manifest is validated and versioned. |
| Skill / SkillVersion | `owner`, `manifest`, `review_state`, `provenance`, `version`, `rollback_of` | Published versions are immutable. |
| AgentRun / RunStep | `actor`, `workspace_id`, `status`, `model_route`, `correlation_id` | Each tool/model step is append-only. |
| Artifact / Source | `workspace_id`, `storage_ref`, `content_hash`, `source_run_id`, `retention_class` | Includes originals, markdown, reports and graph output. |
| Approval | `run_step_id`, `requested_action`, `decision`, `decider`, `expires_at` | Binds a decision to a concrete action digest. |
| AuditEvent / UsageRecord | `organization_id`, `actor`, `action`, `resource`, `outcome`, `correlation_id` | Append-only, exportable, retention-controlled. |

## Public API contracts

Version APIs under `/v1`. All endpoints require an authenticated principal and organization/workspace context; SSE endpoints additionally require a run-scoped authorization check.

| Area | Interface |
|---|---|
| Conversations | `POST /v1/workspaces/{workspaceId}/conversations`, `POST .../messages`, `GET .../events` (SSE) |
| Runs | `POST /v1/workspaces/{workspaceId}/runs`, `GET /v1/runs/{runId}`, `POST .../cancel`, `GET .../events` |
| Knowledge/artifacts | `POST /v1/workspaces/{workspaceId}/uploads`, `GET /v1/artifacts/{artifactId}`, `POST .../collections/{collectionId}/query` |
| Skills/connectors | CRUD endpoints for manifests, versions, review, enablement and rollback; no direct execution endpoint outside a run. |
| Governance | approval queue/decision endpoints, policy simulation/publish, audit search/export and usage queries. |
| Enterprise | organization, role, membership, identity-provider, SCIM and deployment configuration endpoints. |

Run state is `queued → planning → awaiting_approval | executing → succeeded | failed | cancelled | expired`. A run step records idempotency key, policy decision, request digest, bounded output reference and retry count. Only idempotent, non-side-effecting steps may retry automatically.

## Agent and connector flow

1. The client creates a run with a workspace and requested skill/tool context.
2. The run service resolves the published skill versions, provider route and allowed connector capabilities.
3. Before each model, retrieval or tool action, the policy service evaluates actor, workspace, data classification, connector, action, egress destination and approval class.
4. The enforcement service either issues a short-lived scoped execution grant, creates an approval request, or returns a denial.
5. A worker invokes an adapter in a sandbox or process boundary using the grant and injected ephemeral credential.
6. The adapter returns structured output plus sources, cost/usage and execution metadata; outputs become workspace artifacts.
7. Audit events are written for each decision and step; permitted events stream to the client over SSE.

## Knowledge plane

- Store original uploads in encrypted object storage with content hashes and malware-scan status.
- Use anydoc in a worker to generate normalized Markdown plus extraction metadata; scanned PDFs enter a separate OCR policy path.
- Chunk and index only approved text. Preserve chunk-to-artifact offsets for citations.
- Graphify AST-only parsing may build a rebuildable workspace code graph locally. Semantic graph extraction and all external model calls require data-classification and egress approval.
- Graft stays developer-local; Orbital may store an explicitly uploaded graph artifact but must not remotely install hooks or modify local agent configuration.

## Deployment modes

| Concern | Orbital Cloud | Orbital Self-Hosted |
|---|---|---|
| Control plane | Shared service with logical tenant isolation | Customer-operated service and single/multi-org configuration |
| Identity | Orbital tenant SSO/SCIM integration | Customer IdP and network configuration |
| Secrets | Per-tenant envelope encryption with managed KMS | Customer KMS/secret provider or encrypted local secret store |
| Workers/sandbox | Per-tenant queues and isolated execution pools | Customer-controlled worker/sandbox infrastructure |
| Telemetry | Minimal, tenant-isolated operational telemetry | Configurable local telemetry/export only |

## Observability and resilience

- Propagate a correlation ID from HTTP request through run, queue job, adapter call, artifact and audit event.
- Emit structured metrics for run latency, model/tool cost, denied actions, approval time, queue depth, connector errors, index lag and secret-access failures.
- Use idempotency keys, durable queues, dead-letter handling and bounded retries. Side-effecting connector calls require a client-visible confirmation token and cannot be replayed after timeout.
- Maintain backup/restore procedures for metadata and object storage; graph/search indexes are rebuildable from retained artifacts.
