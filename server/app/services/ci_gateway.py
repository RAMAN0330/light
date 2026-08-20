"""Policy-gated, audited CI pipeline triggering (phase 3).

Structurally the same shape as ``InfraGateway.execute_action``: every trigger
attempt is recorded as a ``ci_trigger_runs`` row *before* it can reach
GitHub, defaults to ``require_approval`` for every workspace (seeded in
20260821_orbital_ci_trigger.sql), and an approved trigger is dispatched from
``dispatch_after_approval`` — called from the existing, unmodified
approval-decision endpoint, never a new one.

This is deliberately the last piece built (phase 3), after read-only CI
visibility (phase 1) and gated infra mutations (phase 2): triggering a real
workflow needs a write-scope GitHub token, a materially bigger trust step
than the deployment-wide read-only poll token phase 1 uses, and it can
directly kick off a production deploy — the largest blast radius of the
three phases.

The per-connection token is stored encrypted (``ci_credentials``, RLS with no
client-facing select policy) and is only ever decrypted here, at the moment
of dispatch, through the admin (service-role) client — mirroring exactly how
``ProviderGateway`` handles ``provider_credentials.encrypted_secret``.
"""
from __future__ import annotations

import httpx


class CiGatewayError(ValueError):
    pass


class CiGateway:
    def __init__(self, policies, admin, cipher, github_api_url: str, client: httpx.AsyncClient | None = None) -> None:
        self.policies = policies
        self.admin = admin
        self.cipher = cipher
        self.github_api_url = github_api_url.rstrip("/")
        self.client = client

    def _audit(self, user_id: str, workspace_id: str, action: str, status: str) -> None:
        if hasattr(self.policies, "record_tool_event"):
            self.policies.record_tool_event(user_id, workspace_id, action, {"status": status})

    def _decrypt_token(self, ci_connection_id: str) -> str | None:
        if not self.admin or not self.cipher:
            return None
        rows = (
            self.admin.table("ci_credentials")
            .select("encrypted_secret")
            .eq("ci_connection_id", ci_connection_id)
            .limit(1)
            .execute()
            .data
        )
        if not rows:
            return None
        return self.cipher.decrypt(rows[0]["encrypted_secret"])

    async def trigger_run(self, user_id: str, workspace_id: str, connection: dict, workflow_ref: str, git_ref: str = "main") -> dict:
        action = "pipeline.run.trigger"
        decision = self.policies.policy_decision(workspace_id, action)
        if decision == "deny":
            self.policies.create_ci_trigger_run(user_id, workspace_id, connection["id"], workflow_ref, git_ref, "failed")
            self._audit(user_id, workspace_id, action, "denied")
            return {"status": "denied", "reason": "Workspace policy denied this action."}
        if decision == "require_approval":
            approval = self.policies.create_approval_request(
                user_id, workspace_id, action, f"Trigger {workflow_ref}@{git_ref} on {connection['external_ref']}"
            )
            self.policies.create_ci_trigger_run(user_id, workspace_id, connection["id"], workflow_ref, git_ref, "queued", approval["id"])
            self._audit(user_id, workspace_id, action, "approval_required")
            return {"status": "approval_required", "approval_id": approval["id"]}
        trigger_run = self.policies.create_ci_trigger_run(user_id, workspace_id, connection["id"], workflow_ref, git_ref, "running")
        return await self._dispatch(user_id, workspace_id, trigger_run, connection)

    async def dispatch_after_approval(self, user_id: str, workspace_id: str, trigger_run: dict, connection: dict) -> dict:
        """Called after an approval-request decision, never on the initial request path."""
        return await self._dispatch(user_id, workspace_id, trigger_run, connection)

    async def _dispatch(self, user_id: str, workspace_id: str, trigger_run: dict, connection: dict) -> dict:
        action = "pipeline.run.trigger"
        token = self._decrypt_token(connection["id"])
        if not token:
            self.policies.update_ci_trigger_run(trigger_run["id"], "failed", "No GitHub token is registered for this CI connection.")
            self._audit(user_id, workspace_id, action, "unavailable")
            return {"status": "unavailable", "reason": "No GitHub token is registered for this CI connection."}
        url = f"{self.github_api_url}/repos/{connection['external_ref']}/actions/workflows/{trigger_run['workflow_ref']}/dispatches"
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}
        payload = {"ref": trigger_run["git_ref"]}
        try:
            if self.client:
                response = await self.client.post(url, json=payload, headers=headers)
            else:
                async with httpx.AsyncClient(timeout=20.0) as new_client:
                    response = await new_client.post(url, json=payload, headers=headers)
            response.raise_for_status()
        except httpx.HTTPError as error:
            self.policies.update_ci_trigger_run(trigger_run["id"], "failed", str(error))
            self._audit(user_id, workspace_id, action, "failed")
            return {"status": "failed", "error": str(error)}
        self.policies.update_ci_trigger_run(trigger_run["id"], "succeeded")
        self._audit(user_id, workspace_id, action, "completed")
        return {"status": "completed"}
