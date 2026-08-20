# Orbital Phase 1 Release Runbook

## Release contents

Phase 1 ships organization and workspace tenancy, built-in and custom roles, governed skills, disabled-by-default MCP registrations, policy decisions and approvals, BYOK provider credentials, streaming agent runs with cancellation, audit exports, and the associated Orbital user interface.

## Required deployment configuration

1. Apply `supabase/schema.sql` only for a new project. For an existing project, apply `supabase/migrations/20260814_orbital_foundation.sql` once through the Supabase SQL editor or migration pipeline.
2. Store `SUPABASE_SECRET_KEY`, `OPENROUTER_API_KEY`, and `ORBITAL_ENCRYPTION_KEY` only in a server-side secret manager. Generate the Fernet key before creating any provider credential; rotate it only through a planned re-encryption migration.
3. Set `ORBITAL_CORS_ORIGINS` to explicit HTTPS application origins. Do not use a wildcard with credentialed browser sessions.
4. Enable the chosen OIDC or SAML connection in Supabase Auth and configure its redirect URLs. Configure SCIM at the IdP and restrict the bearer token to provisioning operations. These are provider-side, administrator-owned changes and cannot be completed from this repository.
5. Deploy the API and client containers using `docker compose up --build`, or use the equivalent platform deployment. Inject browser-safe `VITE_*` values only into the client and server-only values only into the API.

## Pre-production validation

Run locally and in CI:

```bash
cd server && .venv/bin/python -m compileall -q app && .venv/bin/python -m pytest -q
cd client && npm test -- --run && npm run build
```

In a dedicated staging tenant, manually verify:

- A member cannot read another organization's workspace, conversations, policies, approvals, skills, connectors, or audit events.
- Viewer/auditor roles cannot mutate governance state; owner/platform/workspace admins can only within their permitted scope.
- Provider credential API responses contain metadata only; encrypted values remain server-only.
- A connector starts disabled, rejects localhost/private-IP or credentialed endpoints, and requires a policy decision before invocation.
- Skill manifests declare `tools` and `data_access`; lifecycle transitions follow draft → review → published → retired.
- A pending approval can be decided once; an active streaming run can be cancelled.
- SSO login, SCIM create/update/deprovision, and session revocation work against the configured IdP.

## Rollout and rollback

Roll out to an internal organization first, with all connector policies set to `require_approval`. Monitor audit events, failed agent runs, authorization denials, and API error rates. Enable external connectors per workspace only after their endpoint and manifest have been reviewed.

Rollback application code by deploying the preceding container image. Disable a connector immediately through its enabled flag, retire a compromised skill, revoke the affected provider credential, and rotate any suspected leaked secret. Do not roll back the tenancy schema destructively; it is additive and data-bearing.

## Incident response

For suspected cross-tenant access, credential exposure, or unsafe tool egress: disable the relevant connector, revoke provider credentials, preserve audit events, invalidate sessions in Supabase Auth, and rotate server secrets. Record the organization, workspace, actor, time window, and affected resource IDs before remediation so evidence remains available for review.

## Phase 2 intelligence gate

Apply `supabase/migrations/20260815_orbital_intelligence.sql` after the foundation migration and create a private `orbital-artifacts` Supabase Storage bucket. Verify a non-member cannot upload, list, normalize, search, or receive a signed URL for another workspace’s artifact. Keep Graphify, Graft, Headroom, and Agent Reach registrations disabled until their separate connector and upstream security reviews are approved. Research reports must preserve artifact citations; accepted skill observations create drafts only and follow the existing review lifecycle before publication.

## Phase 3 workspace operations gate

Apply `supabase/migrations/20260816_orbital_workspace_operations.sql`. Verify workspace membership before task/note/activity access, and confirm notification reads are recipient-scoped. Keep notifications in-app only for this slice; email, calendar, schedules, and delegated execution remain later Phase 3 releases.
