# Orbital Security and Access Design

## Security objectives

Protect tenant data, credentials and execution environments while allowing auditable, policy-controlled agent work. Security-sensitive operations must be denied by default, scoped to the minimum required authority and attributable to a human or service identity.

## Identity and enterprise access

- Support local authentication only for bootstrap/self-host use; production organizations use OIDC or SAML SSO.
- SCIM provisions, updates, deactivates and group-maps users. Deprovisioning revokes active sessions, workspace access, outstanding approvals and connector grants.
- Built-in roles: owner, platform admin, workspace admin, member, viewer and auditor. Custom roles are composed from granular grants; deny rules override grants.
- Roles are scoped to organization or workspace. A platform admin is not automatically a member of every workspace unless an explicit break-glass policy is invoked and audited.
- Require MFA for owners/platform admins, step-up authentication for secret export, policy publication, role escalation and SSO configuration.

## Authorization model

Every request and worker step carries `organization_id`, `workspace_id`, `principal`, `resource`, `action`, `data_classification` and `correlation_id`. The policy decision point returns `allow`, `deny`, or `require_approval` and an immutable decision ID. The policy enforcement point validates that ID at execution time.

Authorization is enforced in API handlers, database row-level security, object-store prefixes/signed URLs, retrieval filters, graph queries, queue payload validation, connector grants and audit-export workers. UI grants are advisory only.

## Credential and key management

- Encrypt BYOK provider and connector credentials with envelope encryption; cloud uses per-tenant KMS keys and self-host supports customer KMS/secret-provider integration.
- Store only a credential reference in connector/run records. Decrypt inside the execution boundary and inject a short-lived, capability-scoped secret.
- Never include secrets in prompts, logs, audit payloads, browser responses, crash reports or artifacts. Apply pattern redaction and structured secret-field exclusion before persistence.
- Rotate, revoke and test credentials without exposing secret values. Rotation/revocation creates an audit event and invalidates active grants.

## Agent, tool and egress controls

- Tool manifests declare capabilities, inputs, data classes, destination allowlists, side-effect classification and approval class.
- Sandbox shell, browser and code execution with unprivileged users, read-only root filesystem, resource/time limits, isolated network namespace and ephemeral workspace mounts.
- Default-deny outbound network policy. Permit only connector-declared domains after DNS/IP revalidation; block private, loopback, link-local and metadata-service addresses to mitigate SSRF.
- Require human approval for write actions, credential use beyond an existing grant, external posting, inbox/calendar mutation, source-code changes and high-risk data egress.
- Apply per-organization and per-connector rate, concurrency, token, duration and spend limits. Side effects use idempotency keys and confirmation digests.

## Data protection and retention

- Classify data at ingest: public, internal, confidential, restricted. Policies control retrieval, connector egress, export, retention and model routing by class.
- Encrypt data in transit and at rest. Use tenant-scoped object prefixes, database RLS and retrieval filters; never rely on metadata filtering alone after retrieval.
- Malware scan and content-type validate uploads before extraction. Treat files, document macros, URLs, web pages and model tool output as untrusted.
- Retain originals, normalized output and citations according to workspace retention policy. Support legal hold, export, deletion workflow and cryptographic deletion where applicable.
- Cloud telemetry is minimal, redacted and tenant-tagged; self-host telemetry is opt-in.

## Audit, monitoring and incident response

- Write append-only audit events for login, SSO/SCIM changes, authorization decisions, key lifecycle, policy change, connector configuration/invocation, skill review, run step, artifact/export and administrator break-glass action.
- Audit events contain actor, target, action, outcome, decision ID, correlation ID, timestamp, workspace and immutable request/response digests; redact sensitive payloads.
- Alert on role escalation, policy weakening, unusual secret access, denied/blocked SSRF, connector failures, excessive tool costs, mass export and cross-tenant authorization anomalies.
- Document severity levels, customer notification duties, evidence preservation, revocation procedure, recovery verification and post-incident corrective-action tracking.

## Security validation gates

Before phase release, run role/tenant negative tests, SSO/SCIM lifecycle tests, secret leak scans, upload fuzzing, SSRF regression tests, sandbox escape tests, MCP/connector permission tests, dependency/SBOM scans, authenticated penetration tests, backup restore tests and self-host upgrade tests.
