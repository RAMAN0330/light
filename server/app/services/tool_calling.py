"""Governed model tool definitions and runner dispatch for Orbital."""
from __future__ import annotations

import re

import httpx


class ToolCallError(ValueError):
    pass


TOOLS = {
    "orbital_document_ingestion": ("anydoc", "document-ingestion", "Convert a workspace document into normalized text.", "path"),
    "orbital_context_optimization": ("headroom", "context-optimization", "Compress approved workspace context.", "text"),
    "orbital_web_research": ("agent-reach", "web-research", "Perform approved, read-only public web research.", "query"),
    "orbital_code_intelligence": ("graphify", "code-intelligence", "Query a local repository intelligence graph.", "query"),
    "orbital_code_context": ("graft", "code-context", "Query local code context.", "query"),
}
PLUGIN_TO_TOOL = {definition[0]: name for name, definition in TOOLS.items()}
UNSAFE_ARGUMENT = re.compile(r"[;&|`$<>\x00]")


def tool_definitions(skills: list[dict]) -> list[dict]:
    """Expose only explicitly declared tools from published workspace skills."""
    names: set[str] = set()
    for skill in skills:
        if skill.get("status") != "published":
            continue
        for declared in skill.get("manifest", {}).get("tools", []):
            if not isinstance(declared, str) or not declared.startswith("plugin.") or not declared.endswith(".invoke"):
                continue
            tool_name = PLUGIN_TO_TOOL.get(declared.removeprefix("plugin.").removesuffix(".invoke"))
            if tool_name:
                names.add(tool_name)
    return [
        {
            "type": "function",
            "function": {
                "name": name,
                "description": TOOLS[name][2],
                "parameters": {
                    "type": "object",
                    "properties": {TOOLS[name][3]: {"type": "string", "maxLength": 1024}},
                    "required": [TOOLS[name][3]],
                    "additionalProperties": False,
                },
            },
        }
        for name in sorted(names)
    ]


class ToolGateway:
    def __init__(self, policies, runner_url: str, runner_token: str = "", client=None) -> None:
        self.policies = policies
        self.runner_url = runner_url.rstrip("/")
        self.runner_token = runner_token
        self.client = client

    def _audit(self, user_id: str, workspace_id: str, tool_name: str, status: str) -> None:
        if hasattr(self.policies, "record_tool_event"):
            self.policies.record_tool_event(user_id, workspace_id, "tool.call", {"tool": tool_name, "status": status})

    async def execute(self, user_id: str, workspace_id: str, tool_name: str, payload: dict) -> dict:
        if tool_name not in TOOLS:
            raise ToolCallError("Tool is not declared by Orbital")
        plugin_id, capability, _description, parameter = TOOLS[tool_name]
        value = payload.get(parameter)
        if not isinstance(value, str) or not value or len(value) > 1024 or UNSAFE_ARGUMENT.search(value):
            raise ToolCallError("Tool arguments are invalid")
        arguments = (["search", value] if tool_name == "orbital_web_research" else ["ask", value] if tool_name in {"orbital_code_intelligence", "orbital_code_context"} else [value])
        decision = self.policies.policy_decision(workspace_id, f"tool.{capability}.invoke")
        if decision == "deny":
            self._audit(user_id, workspace_id, tool_name, "denied")
            return {"status": "denied", "reason": "Workspace policy denied this tool."}
        if decision == "require_approval":
            approval = self.policies.create_approval_request(user_id, workspace_id, f"tool.{capability}.invoke", f"Run {capability}")
            self._audit(user_id, workspace_id, tool_name, "approval_required")
            return {"status": "approval_required", "approval_id": approval["id"]}
        if not self.runner_url or not self.runner_token:
            self._audit(user_id, workspace_id, tool_name, "unavailable")
            return {"status": "unavailable", "reason": "Orbital runners are not configured."}
        if self.client:
            response = await self.client.post(f"{self.runner_url}/execute", json={"plugin": plugin_id, "arguments": arguments}, headers={"X-Orbital-Runner-Token": self.runner_token})
        else:
            async with httpx.AsyncClient(timeout=65.0) as client:
                response = await client.post(f"{self.runner_url}/execute", json={"plugin": plugin_id, "arguments": arguments}, headers={"X-Orbital-Runner-Token": self.runner_token})
        response.raise_for_status()
        self._audit(user_id, workspace_id, tool_name, "completed")
        return {"status": "completed", "output": response.json().get("output", "")[:20000]}
