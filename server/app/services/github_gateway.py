"""Policy-gated, audited read proxy to the GitHub REST API.

Same shape as InfraGateway.list_resources / CiGateway: every read goes
through policy_decision first (default allow, seeded in
20260822_orbital_repo_browsing.sql), is audited via record_tool_event, and
never hands a GitHub token to the browser. The per-connection write-scope
token stored in ``ci_credentials`` (added for CI triggering) is reused here
as the read credential too — one connection, one credential, three surfaces
(CI triggering, repo browsing, codebase intelligence). Falls back to the
deployment-wide read-only poll token, then to unauthenticated (rate-limited)
GitHub access for public repos, exactly like ci_ingestion's poll fallback.
"""
from __future__ import annotations

import base64

import httpx


class GitHubGatewayError(ValueError):
    pass


class GitHubGateway:
    def __init__(self, policies, admin, cipher, github_api_url: str, poll_token: str = "", client: httpx.AsyncClient | None = None) -> None:
        self.policies = policies
        self.admin = admin
        self.cipher = cipher
        self.github_api_url = github_api_url.rstrip("/")
        self.poll_token = poll_token
        self.client = client

    def _audit(self, user_id: str, workspace_id: str, action: str, status: str) -> None:
        if hasattr(self.policies, "record_tool_event"):
            self.policies.record_tool_event(user_id, workspace_id, action, {"status": status})

    def _token_for(self, ci_connection_id: str) -> str | None:
        if self.admin and self.cipher:
            rows = (
                self.admin.table("ci_credentials")
                .select("encrypted_secret")
                .eq("ci_connection_id", ci_connection_id)
                .limit(1)
                .execute()
                .data
            )
            if rows:
                return self.cipher.decrypt(rows[0]["encrypted_secret"])
        return self.poll_token or None

    async def _get(self, path: str, query: dict | None = None, token: str | None = None):
        headers = {"Accept": "application/vnd.github+json"}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        if self.client:
            response = await self.client.get(f"{self.github_api_url}{path}", params=query, headers=headers)
        else:
            async with httpx.AsyncClient(timeout=20.0) as new_client:
                response = await new_client.get(f"{self.github_api_url}{path}", params=query, headers=headers)
        response.raise_for_status()
        return response.json()

    async def _gated(self, user_id: str, workspace_id: str, connection: dict, resource: str, fetch) -> dict:
        action = f"repo.{resource}.read"
        decision = self.policies.policy_decision(workspace_id, action)
        if decision == "deny":
            self._audit(user_id, workspace_id, action, "denied")
            return {"status": "denied", "reason": "Workspace policy denied this action."}
        if decision == "require_approval":
            approval = self.policies.create_approval_request(user_id, workspace_id, action, f"Read {resource} on {connection['external_ref']}")
            self._audit(user_id, workspace_id, action, "approval_required")
            return {"status": "approval_required", "approval_id": approval["id"]}
        token = self._token_for(connection["id"])
        try:
            data = await fetch(token)
        except httpx.HTTPError as error:
            self._audit(user_id, workspace_id, action, "failed")
            return {"status": "failed", "error": str(error)}
        self._audit(user_id, workspace_id, action, "completed")
        return {"status": "completed", "data": data}

    async def repo_info(self, user_id: str, workspace_id: str, connection: dict) -> dict:
        return await self._gated(user_id, workspace_id, connection, "info", lambda token: self._get(f"/repos/{connection['external_ref']}", token=token))

    async def default_branch(self, user_id: str, workspace_id: str, connection: dict) -> str:
        result = await self.repo_info(user_id, workspace_id, connection)
        if result["status"] != "completed":
            return "main"
        return result["data"].get("default_branch") or "main"

    async def tree(self, user_id: str, workspace_id: str, connection: dict, ref: str) -> dict:
        return await self._gated(
            user_id, workspace_id, connection, "tree",
            lambda token: self._get(f"/repos/{connection['external_ref']}/git/trees/{ref}", {"recursive": 1}, token),
        )

    async def file_content(self, user_id: str, workspace_id: str, connection: dict, path: str, ref: str | None = None) -> dict:
        async def fetch(token):
            query = {"ref": ref} if ref else None
            data = await self._get(f"/repos/{connection['external_ref']}/contents/{path}", query, token)
            if isinstance(data, dict) and data.get("content"):
                return base64.b64decode(data["content"]).decode("utf-8", errors="replace")
            return ""

        return await self._gated(user_id, workspace_id, connection, "file", fetch)

    async def commits(self, user_id: str, workspace_id: str, connection: dict, path: str | None = None, ref: str | None = None, limit: int = 30) -> dict:
        query = {"per_page": limit}
        if path:
            query["path"] = path
        if ref:
            query["sha"] = ref
        return await self._gated(user_id, workspace_id, connection, "commits", lambda token: self._get(f"/repos/{connection['external_ref']}/commits", query, token))

    async def branches(self, user_id: str, workspace_id: str, connection: dict) -> dict:
        return await self._gated(
            user_id, workspace_id, connection, "branches",
            lambda token: self._get(f"/repos/{connection['external_ref']}/branches", {"per_page": 100}, token),
        )

    async def pull_requests(self, user_id: str, workspace_id: str, connection: dict, state: str = "open") -> dict:
        return await self._gated(
            user_id, workspace_id, connection, "pr",
            lambda token: self._get(f"/repos/{connection['external_ref']}/pulls", {"state": state}, token),
        )

    async def pull_request(self, user_id: str, workspace_id: str, connection: dict, number: int) -> dict:
        async def fetch(token):
            pr = await self._get(f"/repos/{connection['external_ref']}/pulls/{number}", token=token)
            pr["files"] = await self._get(f"/repos/{connection['external_ref']}/pulls/{number}/files", token=token)
            return pr

        return await self._gated(user_id, workspace_id, connection, "pr", fetch)

    async def compare(self, user_id: str, workspace_id: str, connection: dict, base: str, head: str) -> dict:
        return await self._gated(
            user_id, workspace_id, connection, "compare",
            lambda token: self._get(f"/repos/{connection['external_ref']}/compare/{base}...{head}", token=token),
        )

    async def contributors(self, user_id: str, workspace_id: str, connection: dict, limit: int = 20) -> dict:
        return await self._gated(
            user_id, workspace_id, connection, "contributors",
            lambda token: self._get(f"/repos/{connection['external_ref']}/contributors", {"per_page": limit}, token),
        )

    async def tags(self, user_id: str, workspace_id: str, connection: dict, limit: int = 10) -> dict:
        return await self._gated(
            user_id, workspace_id, connection, "tags",
            lambda token: self._get(f"/repos/{connection['external_ref']}/tags", {"per_page": limit}, token),
        )
