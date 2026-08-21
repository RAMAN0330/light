import base64

import pytest

from app.services.commit_analysis import (
    analyze_files,
    count_functions,
    ingest_github_push_event,
    sync_commit_analysis_for_connection,
    token_for_connection,
)


def test_count_functions_counts_js_and_python_definitions():
    content = "function a() {}\nconst b = 1\ndef c():\n    pass\n"

    assert count_functions(content) == 2


def test_analyze_files_flags_circular_dependency_between_two_files():
    files = [
        {"path": "a.ts", "content": "import { b } from './b'"},
        {"path": "b.ts", "content": "import { a } from './a'"},
    ]

    result = analyze_files(files)

    assert any(issue["title"].startswith("Circular dependency") for issue in result["issues"])
    assert result["stats"]["connections"] == 2


def test_analyze_files_flags_a_large_file():
    functions = "\n".join(f"function fn{i}() {{}}" for i in range(20))
    files = [{"path": "big.js", "content": functions}]

    result = analyze_files(files)

    assert any(issue["title"].startswith("Large file: big.js") for issue in result["issues"])
    assert result["health_score"] < 100


def test_analyze_files_gives_a_clean_file_a_perfect_score():
    files = [{"path": "clean.js", "content": "function ok() { return 1 }"}]

    result = analyze_files(files)

    assert result["issues"] == []
    assert result["health_score"] == 100
    assert result["grade"] == "A"


class FakeRepository:
    def __init__(self, already_analyzed=None):
        self._already_analyzed = already_analyzed or set()
        self.upserts = []

    def list_enabled_ci_connections(self):
        return [{"id": "conn-1", "workspace_id": "workspace-1", "provider": "github_actions", "external_ref": "acme/widgets"}]

    def analyzed_commit_shas(self, ci_connection_id, shas):
        return {sha for sha in shas if sha in self._already_analyzed}

    def upsert_commit_analysis(self, workspace_id, ci_connection_id, commit_sha, branch, result):
        self.upserts.append((workspace_id, ci_connection_id, commit_sha, branch, result))


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self.payload


class FakeClient:
    def __init__(self, blob_content: str):
        self.blob_content = blob_content

    async def get(self, url, headers=None, params=None):
        if url.endswith("/repos/acme/widgets"):
            return FakeResponse({"default_branch": "main"})
        if url.endswith("/commits"):
            return FakeResponse([{"sha": "old-sha"}, {"sha": "new-sha"}])
        if "/git/trees/" in url:
            return FakeResponse({"tree": [{"path": "a.js", "type": "blob", "sha": "blob-1", "size": 10}]})
        if "/git/blobs/" in url:
            return FakeResponse({"content": self.blob_content})
        raise AssertionError(f"unexpected url {url}")


@pytest.mark.asyncio
async def test_sync_commit_analysis_for_connection_analyzes_new_commits():
    connection = {"id": "conn-1", "workspace_id": "workspace-1", "external_ref": "acme/widgets"}
    repository = FakeRepository(already_analyzed={"old-sha"})
    blob_content = base64.b64encode(b"function ok() { return 1 }").decode()

    analyzed = await sync_commit_analysis_for_connection(
        repository, connection, "token", "https://api.github.com", FakeClient(blob_content)
    )

    assert analyzed == 1
    assert repository.upserts[0][2] == "new-sha"
    assert repository.upserts[0][3] == "main"
    assert repository.upserts[0][4]["health_score"] == 100


@pytest.mark.asyncio
async def test_ingest_github_push_event_analyzes_the_head_commit():
    connection = {"id": "conn-1", "workspace_id": "workspace-1", "external_ref": "acme/widgets"}
    repository = FakeRepository()
    blob_content = base64.b64encode(b"function ok() { return 1 }").decode()
    payload = {"after": "push-sha", "ref": "refs/heads/main"}

    result = await ingest_github_push_event(repository, connection, payload, "token", "https://api.github.com", FakeClient(blob_content))

    assert result["health_score"] == 100
    assert repository.upserts[0][2] == "push-sha"
    assert repository.upserts[0][3] == "main"


@pytest.mark.asyncio
async def test_ingest_github_push_event_ignores_branch_deletes():
    connection = {"id": "conn-1", "workspace_id": "workspace-1", "external_ref": "acme/widgets"}
    repository = FakeRepository()
    payload = {"after": "0" * 40, "ref": "refs/heads/doomed-branch"}

    result = await ingest_github_push_event(repository, connection, payload, "token", "https://api.github.com", FakeClient(""))

    assert result is None
    assert repository.upserts == []


@pytest.mark.asyncio
async def test_ingest_github_push_event_skips_already_analyzed_commits():
    connection = {"id": "conn-1", "workspace_id": "workspace-1", "external_ref": "acme/widgets"}
    repository = FakeRepository(already_analyzed={"push-sha"})
    payload = {"after": "push-sha", "ref": "refs/heads/main"}

    result = await ingest_github_push_event(repository, connection, payload, "token", "https://api.github.com", FakeClient(""))

    assert result is None
    assert repository.upserts == []


class FakeAdminTable:
    def __init__(self, rows):
        self.rows = rows

    def table(self, _name):
        return self

    def select(self, _cols):
        return self

    def eq(self, _col, _value):
        return self

    def limit(self, _n):
        return self

    def execute(self):
        return self

    @property
    def data(self):
        return self.rows


class FakeCipher:
    def decrypt(self, value):
        return value.removeprefix("encrypted:")


def test_token_for_connection_prefers_the_connections_own_credential():
    admin = FakeAdminTable([{"encrypted_secret": "encrypted:conn-token"}])

    assert token_for_connection(admin, FakeCipher(), "conn-1", "poll-token") == "conn-token"


def test_token_for_connection_falls_back_to_the_poll_token():
    admin = FakeAdminTable([])

    assert token_for_connection(admin, FakeCipher(), "conn-1", "poll-token") == "poll-token"
