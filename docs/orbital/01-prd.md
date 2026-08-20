# Orbital Product Requirements Document

## Product definition

Orbital is a secure AI workspace for organizations. It combines conversational agents, governed tools, knowledge retrieval, developer intelligence, scheduled work and productivity workflows while allowing customers to choose cloud-hosted or self-hosted deployment and bring their own model/provider credentials.

## Users and problems

| Persona | Current problem | Orbital outcome |
|---|---|---|
| Knowledge worker | Research and files are scattered; AI answers cannot be verified. | Cited, workspace-scoped research and documents with controlled connectors. |
| Builder | An agent repeatedly rediscoveres the codebase and cannot safely use tools. | Graph-backed coding context, governed skills and explicit tool approvals. |
| Workspace admin | AI tools expose data, secrets and connectors without durable controls. | Central policies, roles, secrets, audits, SSO/SCIM and tenant boundaries. |
| Security/audit team | They cannot reconstruct what an agent accessed or did. | Immutable audit events, approval history, provenance and exportable evidence. |

## Goals

- Make a single, authenticated workspace the place where users converse with agents, run approved tools, upload knowledge and inspect artifacts.
- Support multi-tenant cloud and self-hosted deployment from one service contract.
- Give enterprises controllable access through custom RBAC, OIDC/SAML, SCIM, audit logs and policy enforcement.
- Support customer-managed model and connector credentials in v1.
- Make external content, tool calls, model outputs and generated artifacts attributable to a source, run, actor and workspace.

## Non-goals

- Forking or embedding the referenced projects.
- Managed model credits, billing or marketplace revenue in v1.
- Unattended shell/browser/email execution without a policy and approval trail.
- Autonomous modification or publication of skills.
- A claim of regulatory certification before evidence and audits exist.

## Phased requirements

### Phase 1 — trusted foundation

- Organizations, workspaces, custom roles, memberships, policies, SSO/SCIM and managed sessions.
- Conversations, streamed model responses, persisted history, agent runs, artifacts, basic skills, MCP registry and approval inbox.
- Tenant-scoped BYOK vault, provider routing, audit search/export, admin console and deployment configuration.

Success: an administrator can provision a user, assign least-privilege workspace access, configure a provider key, allow a read-only tool, approve or deny a protected tool action, and export the complete run/audit record.

### Phase 2 — intelligence

- File uploads and anydoc normalization; source citations, retrieval collections and research reports.
- Opt-in Graphify knowledge/code graphs, optional Graft developer-local context, optional Headroom optimization and controlled Agent Reach research.
- Skill catalog, review/publish/rollback process and observation recommendations.

Success: a user can ask a cited question over approved workspace material; an admin can inspect what content and connector were used; a reviewer can publish or roll back a skill version without modifying an active version in place.

### Phase 3 — operational workspace

- Projects, tasks, notes, document authoring, notifications, schedules and governed email/calendar connectors.
- Parallel delegated runs in isolated environments, retention/export policies, enterprise analytics and governance workflows.

Success: an organization can automate a scheduled, approved workflow, track its artifacts and cost, and revoke a connector or user without residual access.

## Product metrics

- Authorization: zero verified cross-organization access paths in automated negative tests.
- Auditability: 100% of agent runs, tool calls, approvals, connector invocations and secret lifecycle actions emit a correlated audit event.
- Trust: 100% of research-report factual claims link to retained sources or are marked uncited.
- Reliability: 99.9% monthly control-plane availability target after Phase 1; failed runs expose a recoverable error and do not silently repeat privileged side effects.
- Adoption: at least 60% of active workspaces create a governed skill, connector or knowledge collection within 30 days of enablement.

## Product requirements

- All user-visible data is organization and workspace scoped; users must select or inherit an active workspace before creating a run.
- Tool capabilities are policy evaluated immediately before execution, not only at configuration time.
- Every privileged action has one of three outcomes: automatically allowed by policy, held for approved actor confirmation, or denied with a reason.
- Model providers are interchangeable through a provider routing interface. The browser never receives provider secrets.
- Users can see run status, sources, tool activity, approvals, artifacts, errors and cancellation state in real time.
- Cloud and self-hosted deployments share API semantics, role behavior and audit schema; infrastructure implementations may differ.
