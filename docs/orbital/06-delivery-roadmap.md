# Orbital Delivery Roadmap

## Delivery model

Ship thin vertical slices. Each phase must be usable, secure and observable on its own; later phases extend the same organization, workspace, policy, run, artifact and audit contracts rather than introducing parallel systems.

## Milestones

| Milestone | Outcome | Exit gate |
|---|---|---|
| M0 — Foundations | Architecture decisions, threat model, contracts, deployment baseline and test harness. | API/authorization contracts reviewed; tenant model and data classifications approved. |
| M1 — Governed agent workspace | Phase 1 organization/RBAC, BYOK, chat/runs, skills/connectors, approvals, audit and admin console. | Cross-tenant, role, secret, approval and SSE tests pass; cloud and self-host smoke deployments succeed. |
| M2 — Trusted knowledge | Phase 2 ingestion, citations, knowledge collections, reports, Graphify and governed optional adapters. | Upload, retrieval, citation, egress and connector-disable tests pass; provenance is visible end-to-end. |
| M3 — Operational workspace | Phase 3 projects/tasks/schedules, communications connectors, delegated execution, retention and analytics. | Sandboxed delegation, scheduled-run, connector revoke, retention/export and recovery drills pass. |
| M4 — Production hardening | Performance, threat remediation, runbooks, support workflows and staged rollout. | SLO/error-budget monitoring, backup restore, penetration findings disposition and customer pilot sign-off. |

## Migration sequence

1. Keep the current chat schema operational while introducing organization/workspace ownership and safe backfill paths.
2. Add API versioning and tenancy-aware repositories before exposing new UI modules.
3. Introduce audit events and policy decision capture before enabling MCP, skills or external connectors.
4. Migrate provider configuration from environment-only settings to encrypted organization/workspace credential references; retain a self-host bootstrap path.
5. Add artifact/object storage and ingestion workers before retrieval or graph features.
6. Add high-risk connectors only after sandbox, egress and approval controls have passed security gates.

## Rollout and operational controls

- Enable each connector and execution capability behind organization-scoped feature flags.
- Begin with internal/self-host test tenants, then design partners, then general availability; do not enable write-capable connectors at GA without approval policies.
- Use kill switches for model routing, MCP/CLI connector categories, egress, workers and scheduled runs.
- Track run success/failure/cancellation, queue delay, approval latency, denied actions, citation coverage, retrieval quality, connector health, token/cost use, RLS violations and security detections.
- Publish operator runbooks for failed runs, stuck approvals, key rotation, compromised connector, data deletion/export, IdP outage, queue backlog and rollback.

## Release quality bar

- Contract, unit, integration and end-to-end tests cover positive and negative authorization paths.
- Accessibility checks cover all user-facing Phase features; performance tests cover streaming, concurrent runs and upload/index queues.
- Every deployment includes migration rollback/forward guidance and health checks.
- Every production connector has a named owner, operational dashboard, alerting threshold, documented data flow, secret rotation procedure and disable control.

## Explicit deferrals

Managed model credits/billing, unrestricted marketplace installation, unattended external write actions, arbitrary customer-supplied container images and compliance-certification claims are deferred until their security, legal and operational programs are separately approved.
