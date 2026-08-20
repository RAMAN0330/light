"""Read-only CI/CD pipeline-run ingestion (GitHub Actions, phase 1).

Two feeders write to the same ``pipeline_runs`` table via an idempotent
upsert on ``(ci_connection_id, external_run_id)``:

- ``ingest_github_webhook_event`` — push-based, called from the webhook
  route in ``api/organizations.py`` after signature verification.
- ``sync_ci_connection`` — poll-based fallback, called from the standalone
  worker script ``app/workers/ci_sync.py`` (run by the same trusted external
  scheduler as ``app/workers/schedules.py``, never by the API server).

Both are read-only against the CI provider: neither ever triggers, cancels,
or re-runs a pipeline. Triggering (``pipeline.run.trigger``) is a later,
explicitly mutating phase gated the same way infra actions are.
"""
from __future__ import annotations

import hashlib
import hmac

import httpx

_GITHUB_STATUS = {"queued": "queued", "in_progress": "running", "waiting": "queued"}
_GITHUB_CONCLUSION = {
    "success": "succeeded",
    "cancelled": "cancelled",
    "skipped": "cancelled",
    "neutral": "succeeded",
}


def _status_from_github_run(run: dict) -> str:
    if run.get("status") != "completed":
        return _GITHUB_STATUS.get(run.get("status", ""), "queued")
    return _GITHUB_CONCLUSION.get(run.get("conclusion") or "", "failed")


def normalize_github_run(run: dict) -> dict:
    return {
        "external_run_id": str(run["id"]),
        "pipeline_name": run.get("name") or run.get("path") or "workflow",
        "branch": run.get("head_branch"),
        "commit_sha": run.get("head_sha"),
        "status": _status_from_github_run(run),
        "triggered_by": (run.get("triggering_actor") or {}).get("login"),
        "details": {"html_url": run.get("html_url"), "run_number": run.get("run_number")},
        "completed_at": run.get("updated_at") if run.get("status") == "completed" else None,
    }


async def sync_ci_connection(repository, connection: dict, github_token: str, github_api_url: str, client: httpx.AsyncClient | None = None) -> int:
    """Poll GitHub Actions for one connection; returns the number of runs upserted."""
    headers = {"Accept": "application/vnd.github+json"}
    if github_token:
        headers["Authorization"] = f"Bearer {github_token}"
    url = f"{github_api_url}/repos/{connection['external_ref']}/actions/runs?per_page=20"
    if client:
        response = await client.get(url, headers=headers)
    else:
        async with httpx.AsyncClient(timeout=20.0) as new_client:
            response = await new_client.get(url, headers=headers)
    response.raise_for_status()
    runs = response.json().get("workflow_runs", [])
    for run in runs:
        repository.upsert_pipeline_run(connection["workspace_id"], connection["id"], normalize_github_run(run))
    return len(runs)


async def sync_all_ci_connections(repository, github_token: str, github_api_url: str) -> dict:
    connections = repository.list_enabled_ci_connections()
    counts = {"connections": 0, "runs": 0}
    async with httpx.AsyncClient(timeout=20.0) as client:
        for connection in connections:
            if connection["provider"] != "github_actions":
                continue
            counts["connections"] += 1
            counts["runs"] += await sync_ci_connection(repository, connection, github_token, github_api_url, client)
    return counts


def verify_github_webhook_signature(secret: str, payload_body: bytes, signature_header: str | None) -> bool:
    if not secret or not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), payload_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature_header)


def ingest_github_webhook_event(repository, connection: dict, payload: dict) -> dict | None:
    """Handle a ``workflow_run`` webhook event; ignores any other event type."""
    run = payload.get("workflow_run")
    if not isinstance(run, dict):
        return None
    result = repository.upsert_pipeline_run(connection["workspace_id"], connection["id"], normalize_github_run(run))
    return result[0] if result else None
