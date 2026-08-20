import hashlib
import hmac

import pytest

from app.services.ci_ingestion import (
    ingest_github_webhook_event,
    normalize_github_run,
    sync_ci_connection,
    verify_github_webhook_signature,
)

GITHUB_RUN = {
    "id": 42,
    "name": "CI",
    "head_branch": "main",
    "head_sha": "abc123",
    "status": "completed",
    "conclusion": "success",
    "triggering_actor": {"login": "octocat"},
    "html_url": "https://github.com/acme/widgets/actions/runs/42",
    "run_number": 7,
    "updated_at": "2026-08-19T10:00:00Z",
}


def test_normalize_github_run_maps_completed_success_to_succeeded():
    normalized = normalize_github_run(GITHUB_RUN)

    assert normalized["external_run_id"] == "42"
    assert normalized["status"] == "succeeded"
    assert normalized["branch"] == "main"
    assert normalized["commit_sha"] == "abc123"
    assert normalized["triggered_by"] == "octocat"
    assert normalized["completed_at"] == "2026-08-19T10:00:00Z"


def test_normalize_github_run_maps_in_progress_to_running():
    run = {**GITHUB_RUN, "status": "in_progress", "conclusion": None}

    normalized = normalize_github_run(run)

    assert normalized["status"] == "running"
    assert normalized["completed_at"] is None


def test_normalize_github_run_maps_failure_conclusion_to_failed():
    run = {**GITHUB_RUN, "conclusion": "failure"}

    assert normalize_github_run(run)["status"] == "failed"


def test_verify_github_webhook_signature_accepts_a_correctly_signed_body():
    secret = "top-secret"
    body = b'{"workflow_run": {}}'
    signature = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()

    assert verify_github_webhook_signature(secret, body, signature) is True


def test_verify_github_webhook_signature_rejects_a_tampered_body():
    secret = "top-secret"
    signature = "sha256=" + hmac.new(secret.encode(), b"original", hashlib.sha256).hexdigest()

    assert verify_github_webhook_signature(secret, b"tampered", signature) is False


def test_verify_github_webhook_signature_rejects_missing_header_or_secret():
    assert verify_github_webhook_signature("secret", b"body", None) is False
    assert verify_github_webhook_signature("", b"body", "sha256=whatever") is False


class FakeRepository:
    def __init__(self):
        self.upserts = []

    def upsert_pipeline_run(self, workspace_id, ci_connection_id, run):
        self.upserts.append((workspace_id, ci_connection_id, run))
        return [{"id": "run-1", **run}]


def test_ingest_github_webhook_event_upserts_a_workflow_run():
    repository = FakeRepository()
    connection = {"id": "conn-1", "workspace_id": "workspace-1"}

    result = ingest_github_webhook_event(repository, connection, {"workflow_run": GITHUB_RUN})

    assert result["id"] == "run-1"
    assert repository.upserts[0][0] == "workspace-1"
    assert repository.upserts[0][1] == "conn-1"
    assert repository.upserts[0][2]["external_run_id"] == "42"


def test_ingest_github_webhook_event_ignores_non_workflow_run_events():
    repository = FakeRepository()

    result = ingest_github_webhook_event(repository, {"id": "conn-1", "workspace_id": "workspace-1"}, {"action": "opened"})

    assert result is None
    assert repository.upserts == []


class FakeGithubResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self.payload


class FakeGithubClient:
    def __init__(self, payload):
        self.payload = payload
        self.calls = []

    async def get(self, url, headers):
        self.calls.append((url, headers))
        return FakeGithubResponse(self.payload)


@pytest.mark.asyncio
async def test_sync_ci_connection_upserts_every_run_returned_by_github():
    repository = FakeRepository()
    connection = {"id": "conn-1", "workspace_id": "workspace-1", "external_ref": "acme/widgets"}
    client = FakeGithubClient({"workflow_runs": [GITHUB_RUN, {**GITHUB_RUN, "id": 43}]})

    count = await sync_ci_connection(repository, connection, "gh-token", "https://api.github.com", client)

    assert count == 2
    assert len(repository.upserts) == 2
    assert client.calls[0][0] == "https://api.github.com/repos/acme/widgets/actions/runs?per_page=20"
    assert client.calls[0][1]["Authorization"] == "Bearer gh-token"
