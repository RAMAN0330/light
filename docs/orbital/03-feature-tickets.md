# Orbital Feature Tickets

Tickets are ordered by dependency. Risk is the delivery/security risk if incorrectly implemented.

## Phase 1 — Foundation

| ID | Ticket | Acceptance criteria | Dependencies | Risk |
|---|---|---|---|---|
| ORB-001 | Organization and workspace tenancy | Every persisted business entity has organization/workspace ownership; cross-tenant negative tests fail closed. | Existing auth/schema | Critical |
| ORB-002 | Enterprise RBAC and custom roles | Built-in roles plus custom grants are evaluated server-side for UI and API actions. | ORB-001 | Critical |
| ORB-003 | SSO, SCIM and session administration | OIDC/SAML login, SCIM lifecycle sync, session revocation and audit events work per organization. | ORB-001, ORB-002 | High |
| ORB-004 | Policy engine and approval service | Policies return allow/deny/approval; an approval is action-bound, expiring and fully audited. | ORB-002 | Critical |
| ORB-005 | Provider gateway and BYOK vault | Browser never receives provider secrets; providers can be routed per workspace under policy. | ORB-001, ORB-004 | Critical |
| ORB-006 | Conversation and streamed agent-run API | Users create, observe and cancel tenant-scoped runs; SSE does not leak other users' output. | ORB-001, ORB-005 | High |
| ORB-007 | MCP/connector registry | Manifest validation, enable/disable, capability scoping and version pinning are enforced. | ORB-004, ORB-005 | Critical |
| ORB-008 | Skills registry and review | Skills have immutable published versions, permission declarations, review states and rollback. | ORB-004, ORB-007 | High |
| ORB-009 | Audit and usage ledger | Runs, policies, approvals, secrets and connectors emit correlated append-only events and export safely. | ORB-001 through ORB-008 | Critical |
| ORB-010 | Admin and governance UI | Admins manage organization, roles, policies, keys, connectors, approvals and audit search. | ORB-002 through ORB-009 | High |
| ORB-011 | Deployment baseline | Cloud tenant config and self-host install/config validation share application contracts. | ORB-001 through ORB-009 | High |

## Phase 2 — Intelligence

| ID | Ticket | Acceptance criteria | Dependencies | Risk |
|---|---|---|---|---|
| ORB-101 | Secure upload and artifact pipeline | Files are scanned, encrypted, attributed, retention-classified and downloadable only with workspace authorization. | ORB-001, ORB-009 | Critical |
| ORB-102 | anydoc normalization worker | Supported office documents produce versioned Markdown/source metadata; failures retain original and report reason. | ORB-101 | High |
| ORB-103 | Collections, retrieval and citations | Queries return workspace-authorized results with artifact offsets and visible citations. | ORB-102, ORB-004 | Critical |
| ORB-104 | Research reports | Agent reports preserve source list, connector invocations, uncited-claim markers and exportable artifacts. | ORB-006, ORB-103 | High |
| ORB-105 | Graphify adapter | AST-only graph extraction is isolated and queryable; semantic extraction requires policy/consent. | ORB-101, ORB-007 | High |
| ORB-106 | Optional Headroom adapter | Opt-in compression has provenance, data-boundary notice, bypass and no loss of source artifacts. | ORB-005, ORB-007 | High |
| ORB-107 | Agent Reach research adapter | Read-only, allowlisted invocation, no cookie harvesting, citations and egress logs are enforced. | ORB-004, ORB-007 | Critical |
| ORB-108 | Skill catalog and observations | Recommendations are reviewable drafts; nothing changes/publishes automatically. | ORB-008, ORB-009 | High |
| ORB-109 | Developer-local Graft workflow | Users can register uploaded graph artifacts or launch documented local tooling without remote config writes. | ORB-101, ORB-007 | Medium |

## Phase 3 — Operational workspace

| ID | Ticket | Acceptance criteria | Dependencies | Risk |
|---|---|---|---|---|
| ORB-201 | Projects, tasks and notes | Workspace-scoped collaboration, roles, audit trail and artifact links work consistently. | Phase 1 | Medium |
| ORB-202 | Scheduler and notifications | Schedules run with captured policy/skill versions and controlled delivery channels. | ORB-004, ORB-006, ORB-009 | High |
| ORB-203 | Email/calendar connectors | OAuth scopes, approval classes, rate limits and revoke paths are implemented before write actions. | ORB-007, ORB-202 | Critical |
| ORB-204 | Isolated delegated execution | Subagents run in resource-limited sandboxes with scoped artifacts and parent-run traceability. | ORB-004, ORB-006 | Critical |
| ORB-205 | Retention, export and enterprise analytics | Retention policies, legal hold/export controls and aggregated usage reporting respect access policy. | ORB-009, ORB-101 | High |

## Definition of done

A ticket is complete only when its API/UI authorization paths, success/failure states, audit events, migration/rollback path, tests and operational dashboard signals are implemented and reviewed.
