import pytest

from app.services.github_gateway import GitHubGateway

CONNECTION = {"id": "conn-1", "external_ref": "acme/widgets"}


class FakeCipher:
    def decrypt(self, value):
        return value.removeprefix("encrypted:")


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


class Policies:
    def __init__(self, decision="allow"):
        self.decision = decision
        self.approvals = []
        self.audits = []

    def policy_decision(self, _workspace_id, _action):
        return self.decision

    def create_approval_request(self, user_id, workspace_id, action, summary):
        approval = {"id": "approval-1", "action": action, "summary": summary}
        self.approvals.append((user_id, workspace_id, action, summary))
        return approval

    def record_tool_event(self, user_id, workspace_id, action, details):
        self.audits.append((user_id, workspace_id, action, details))


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self.payload


class FakeClient:
    def __init__(self, payload):
        self.payload = payload
        self.calls = []

    async def get(self, url, params=None, headers=None):
        self.calls.append((url, params, headers))
        return FakeResponse(self.payload)


@pytest.mark.asyncio
async def test_tree_denied_by_policy_never_contacts_github():
    policies = Policies(decision="deny")
    gateway = GitHubGateway(policies, admin=None, cipher=None, github_api_url="https://api.github.com", client=FakeClient({}))

    result = await gateway.tree("user-1", "workspace-1", CONNECTION, "main")

    assert result == {"status": "denied", "reason": "Workspace policy denied this action."}
    assert policies.audits == [("user-1", "workspace-1", "repo.tree.read", {"status": "denied"})]


@pytest.mark.asyncio
async def test_tree_requires_approval_without_contacting_github():
    policies = Policies(decision="require_approval")
    gateway = GitHubGateway(policies, admin=None, cipher=None, github_api_url="https://api.github.com")

    result = await gateway.tree("user-1", "workspace-1", CONNECTION, "main")

    assert result == {"status": "approval_required", "approval_id": "approval-1"}
    assert policies.approvals == [("user-1", "workspace-1", "repo.tree.read", "Read tree on acme/widgets")]


@pytest.mark.asyncio
async def test_tree_uses_the_connections_stored_token_when_present():
    policies = Policies(decision="allow")
    admin = FakeAdminTable([{"encrypted_secret": "encrypted:gh-token"}])
    client = FakeClient({"tree": [{"path": "src/index.ts", "type": "blob"}]})
    gateway = GitHubGateway(policies, admin=admin, cipher=FakeCipher(), github_api_url="https://api.github.com", poll_token="fallback-token", client=client)

    result = await gateway.tree("user-1", "workspace-1", CONNECTION, "main")

    assert result == {"status": "completed", "data": {"tree": [{"path": "src/index.ts", "type": "blob"}]}}
    assert client.calls == [("https://api.github.com/repos/acme/widgets/git/trees/main", {"recursive": 1}, {"Accept": "application/vnd.github+json", "Authorization": "Bearer gh-token"})]
    assert policies.audits == [("user-1", "workspace-1", "repo.tree.read", {"status": "completed"})]


@pytest.mark.asyncio
async def test_tree_falls_back_to_the_poll_token_when_no_connection_credential_exists():
    policies = Policies(decision="allow")
    admin = FakeAdminTable([])
    client = FakeClient({"tree": []})
    gateway = GitHubGateway(policies, admin=admin, cipher=FakeCipher(), github_api_url="https://api.github.com", poll_token="fallback-token", client=client)

    await gateway.tree("user-1", "workspace-1", CONNECTION, "main")

    assert client.calls[0][2]["Authorization"] == "Bearer fallback-token"


@pytest.mark.asyncio
async def test_file_content_decodes_base64_from_the_contents_api():
    import base64

    policies = Policies(decision="allow")
    encoded = base64.b64encode(b"export const x = 1;").decode()
    client = FakeClient({"content": encoded})
    gateway = GitHubGateway(policies, admin=None, cipher=None, github_api_url="https://api.github.com", client=client)

    result = await gateway.file_content("user-1", "workspace-1", CONNECTION, "src/index.ts", "main")

    assert result == {"status": "completed", "data": "export const x = 1;"}
    assert client.calls == [("https://api.github.com/repos/acme/widgets/contents/src/index.ts", {"ref": "main"}, {"Accept": "application/vnd.github+json"})]


@pytest.mark.asyncio
async def test_default_branch_falls_back_to_main_when_repo_info_fails():
    class FailingClient:
        async def get(self, *args, **kwargs):
            raise __import__("httpx").ConnectError("down")

    policies = Policies(decision="allow")
    gateway = GitHubGateway(policies, admin=None, cipher=None, github_api_url="https://api.github.com", client=FailingClient())

    branch = await gateway.default_branch("user-1", "workspace-1", CONNECTION)

    assert branch == "main"


@pytest.mark.asyncio
async def test_pull_request_merges_pr_detail_with_its_changed_files():
    class TwoCallClient:
        def __init__(self):
            self.calls = []

        async def get(self, url, params=None, headers=None):
            self.calls.append(url)
            if url.endswith("/files"):
                return FakeResponse([{"filename": "src/index.ts"}])
            return FakeResponse({"number": 5, "title": "Fix bug"})

    policies = Policies(decision="allow")
    client = TwoCallClient()
    gateway = GitHubGateway(policies, admin=None, cipher=None, github_api_url="https://api.github.com", client=client)

    result = await gateway.pull_request("user-1", "workspace-1", CONNECTION, 5)

    assert result["status"] == "completed"
    assert result["data"]["title"] == "Fix bug"
    assert result["data"]["files"] == [{"filename": "src/index.ts"}]


@pytest.mark.asyncio
async def test_reports_failed_when_github_rejects_the_request():
    import httpx

    class FailingClient:
        async def get(self, *args, **kwargs):
            raise httpx.ConnectError("connection refused")

    policies = Policies(decision="allow")
    gateway = GitHubGateway(policies, admin=None, cipher=None, github_api_url="https://api.github.com", client=FailingClient())

    result = await gateway.branches("user-1", "workspace-1", CONNECTION)

    assert result["status"] == "failed"


@pytest.mark.asyncio
async def test_contributors_calls_the_contributors_endpoint():
    policies = Policies(decision="allow")
    client = FakeClient([{"login": "octocat", "contributions": 42}])
    gateway = GitHubGateway(policies, admin=None, cipher=None, github_api_url="https://api.github.com", client=client)

    result = await gateway.contributors("user-1", "workspace-1", CONNECTION, limit=5)

    assert result == {"status": "completed", "data": [{"login": "octocat", "contributions": 42}]}
    assert client.calls == [("https://api.github.com/repos/acme/widgets/contributors", {"per_page": 5}, {"Accept": "application/vnd.github+json"})]


@pytest.mark.asyncio
async def test_tags_calls_the_tags_endpoint():
    policies = Policies(decision="allow")
    client = FakeClient([{"name": "v1.0.0"}])
    gateway = GitHubGateway(policies, admin=None, cipher=None, github_api_url="https://api.github.com", client=client)

    result = await gateway.tags("user-1", "workspace-1", CONNECTION)

    assert result == {"status": "completed", "data": [{"name": "v1.0.0"}]}
    assert client.calls == [("https://api.github.com/repos/acme/widgets/tags", {"per_page": 10}, {"Accept": "application/vnd.github+json"})]
