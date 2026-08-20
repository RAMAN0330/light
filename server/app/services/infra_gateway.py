"""Policy-gated, audited proxy to the infra-agent service.

Structurally mirrors ``ToolGateway`` in ``tool_calling.py``: every call — reads
included — goes through ``policy_decision`` before it ever reaches
infra-agent, and every outcome is audited via ``record_tool_event``.

Phase 1 (list/logs) never changes infra state. Phase 2 adds ``execute_action``
for mutations (container/pod start/stop/restart/delete, deployment scale):
every mutating action is recorded as an ``infra_action_runs`` row *before* it
can reach infra-agent, defaults to ``require_approval`` (seeded in
20260820_orbital_infra_action_gating.sql), and an approved action is
dispatched from ``dispatch_after_approval`` — called from the existing,
unmodified approval-decision endpoint, never a new one.

The hardened, socket-less ``orbital-runners`` sandbox is never used for this:
talking to a Docker daemon or Kubernetes API server needs credentials that
sandbox intentionally does not have. infra-agent is a separate, minimally
privileged service reached over HTTP, exactly like orbital-runners is.
"""
from __future__ import annotations

import httpx

RESOURCE_TYPES = {"container", "image", "pod", "deployment"}
MUTATING_ACTIONS = {
    "container": {"start", "stop", "restart", "delete"},
    "pod": {"delete"},
    "deployment": {"scale"},
}
AGENT_ACTION_ENDPOINT = {"container": "/containers/action", "pod": "/pods/action", "deployment": "/deployments/scale"}


class InfraGatewayError(ValueError):
    pass


class InfraGateway:
    def __init__(self, policies, agent_url: str, agent_token: str = "", client=None) -> None:
        self.policies = policies
        self.agent_url = agent_url.rstrip("/")
        self.agent_token = agent_token
        self.client = client

    def _audit(self, user_id: str, workspace_id: str, action: str, status: str) -> None:
        if hasattr(self.policies, "record_tool_event"):
            self.policies.record_tool_event(user_id, workspace_id, action, {"status": status})

    async def _call_agent(self, path: str, payload: dict) -> dict:
        headers = {"X-Orbital-Infra-Token": self.agent_token}
        if self.client:
            response = await self.client.post(f"{self.agent_url}{path}", json=payload, headers=headers)
        else:
            async with httpx.AsyncClient(timeout=20.0) as client:
                response = await client.post(f"{self.agent_url}{path}", json=payload, headers=headers)
        response.raise_for_status()
        return response.json()

    async def list_resources(self, user_id: str, workspace_id: str, connection: dict, resource_type: str) -> dict:
        if resource_type not in RESOURCE_TYPES:
            raise InfraGatewayError(f"Unsupported resource type: {resource_type}")
        action = f"infra.{resource_type}.list"
        decision = self.policies.policy_decision(workspace_id, action)
        if decision == "deny":
            self._audit(user_id, workspace_id, action, "denied")
            return {"status": "denied", "reason": "Workspace policy denied this action."}
        if decision == "require_approval":
            approval = self.policies.create_approval_request(user_id, workspace_id, action, f"List {resource_type}s on {connection['name']}")
            self._audit(user_id, workspace_id, action, "approval_required")
            return {"status": "approval_required", "approval_id": approval["id"]}
        if not self.agent_url or not self.agent_token:
            self._audit(user_id, workspace_id, action, "unavailable")
            return {"status": "unavailable", "reason": "The infra agent is not configured."}
        endpoint = {"container": "/containers", "image": "/images", "pod": "/pods", "deployment": "/deployments"}[resource_type]
        result = await self._call_agent(endpoint, {"kind": connection["kind"], "manifest": connection["manifest"]})
        self._audit(user_id, workspace_id, action, "completed")
        return {"status": "completed", "items": result.get("items", [])}

    async def logs(self, user_id: str, workspace_id: str, connection: dict, resource_type: str, resource_ref: str, tail: int = 200) -> dict:
        if resource_type not in {"container", "pod"}:
            raise InfraGatewayError(f"Logs are not supported for resource type: {resource_type}")
        action = f"infra.{resource_type}.logs"
        decision = self.policies.policy_decision(workspace_id, action)
        if decision == "deny":
            self._audit(user_id, workspace_id, action, "denied")
            return {"status": "denied", "reason": "Workspace policy denied this action."}
        if decision == "require_approval":
            approval = self.policies.create_approval_request(user_id, workspace_id, action, f"View logs for {resource_type} {resource_ref}")
            self._audit(user_id, workspace_id, action, "approval_required")
            return {"status": "approval_required", "approval_id": approval["id"]}
        if not self.agent_url or not self.agent_token:
            self._audit(user_id, workspace_id, action, "unavailable")
            return {"status": "unavailable", "reason": "The infra agent is not configured."}
        result = await self._call_agent(
            "/logs",
            {"kind": connection["kind"], "manifest": connection["manifest"], "resource_type": resource_type, "resource_ref": resource_ref, "tail": tail},
        )
        self._audit(user_id, workspace_id, action, "completed")
        return {"status": "completed", "output": result.get("output", "")[:20000]}

    async def execute_action(self, user_id: str, workspace_id: str, connection: dict, resource_type: str, resource_ref: str, action: str, params: dict | None = None) -> dict:
        if action not in MUTATING_ACTIONS.get(resource_type, set()):
            raise InfraGatewayError(f"Unsupported action '{action}' for resource type: {resource_type}")
        policy_action = f"infra.{resource_type}.{action}"
        decision = self.policies.policy_decision(workspace_id, policy_action)
        if decision == "deny":
            self.policies.create_infra_action_run(user_id, workspace_id, connection["id"], policy_action, resource_type, resource_ref, "failed", params, None)
            self._audit(user_id, workspace_id, policy_action, "denied")
            return {"status": "denied", "reason": "Workspace policy denied this action."}
        if decision == "require_approval":
            approval = self.policies.create_approval_request(
                user_id, workspace_id, policy_action, f"{action.capitalize()} {resource_type} {resource_ref} on {connection['name']}"
            )
            self.policies.create_infra_action_run(user_id, workspace_id, connection["id"], policy_action, resource_type, resource_ref, "queued", params, approval["id"])
            self._audit(user_id, workspace_id, policy_action, "approval_required")
            return {"status": "approval_required", "approval_id": approval["id"]}
        action_run = self.policies.create_infra_action_run(user_id, workspace_id, connection["id"], policy_action, resource_type, resource_ref, "running", params, None)
        return await self._dispatch(user_id, workspace_id, action_run, connection)

    async def dispatch_after_approval(self, user_id: str, workspace_id: str, action_run: dict, connection: dict) -> dict:
        """Called after an approval-request decision, never on the initial request path."""
        return await self._dispatch(user_id, workspace_id, action_run, connection)

    async def _dispatch(self, user_id: str, workspace_id: str, action_run: dict, connection: dict) -> dict:
        policy_action = action_run["action"]
        resource_type = action_run["resource_type"]
        action = policy_action.rsplit(".", 1)[-1]
        if not self.agent_url or not self.agent_token:
            self.policies.update_infra_action_run(action_run["id"], "failed", "The infra agent is not configured.")
            self._audit(user_id, workspace_id, policy_action, "unavailable")
            return {"status": "unavailable", "reason": "The infra agent is not configured."}
        payload = {
            "kind": connection["kind"],
            "manifest": connection["manifest"],
            "resource_ref": action_run["resource_ref"],
            "action": action,
            **(action_run.get("params") or {}),
        }
        try:
            await self._call_agent(AGENT_ACTION_ENDPOINT[resource_type], payload)
        except httpx.HTTPError as error:
            self.policies.update_infra_action_run(action_run["id"], "failed", str(error))
            self._audit(user_id, workspace_id, policy_action, "failed")
            return {"status": "failed", "error": str(error)}
        self.policies.update_infra_action_run(action_run["id"], "succeeded")
        self._audit(user_id, workspace_id, policy_action, "completed")
        return {"status": "completed"}
