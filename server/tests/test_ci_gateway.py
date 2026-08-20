import pytest

from app.services.ci_gateway import CiGateway

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
        self.trigger_runs = []
        self.updated_runs = []

    def policy_decision(self, _workspace_id, _action):
        return self.decision

    def create_approval_request(self, user_id, workspace_id, action, summary):
        approval = {"id": "approval-1", "action": action, "summary": summary}
        self.approvals.append((user_id, workspace_id, action, summary))
        return approval

    def record_tool_event(self, user_id, workspace_id, action, details):
        self.audits.append((user_id, workspace_id, action, details))

    def create_ci_trigger_run(self, user_id, workspace_id, ci_connection_id, workflow_ref, git_ref, status, approval_request_id=None):
        run = {
            "id": f"run-{len(self.trigger_runs) + 1}",
            "workspace_id": workspace_id,
            "ci_connection_id": ci_connection_id,
            "workflow_ref": workflow_ref,
            "git_ref": git_ref,
            "status": status,
            "approval_request_id": approval_request_id,
            "requested_by": user_id,
        }
        self.trigger_runs.append(run)
        return run

    def update_ci_trigger_run(self, trigger_run_id, status, error=None):
        self.updated_runs.append((trigger_run_id, status, error))


@pytest.mark.asyncio
async def test_trigger_run_denied_by_policy_never_contacts_github():
    calls = []

    class FakeClient:
        async def post(self, *args, **kwargs):
            calls.append((args, kwargs))

    policies = Policies(decision="deny")
    gateway = CiGateway(policies, admin=None, cipher=None, github_api_url="https://api.github.com", client=FakeClient())

    result = await gateway.trigger_run("user-1", "workspace-1", CONNECTION, "ci.yml")

    assert result == {"status": "denied", "reason": "Workspace policy denied this action."}
    assert calls == []
    assert policies.trigger_runs[0]["status"] == "failed"


@pytest.mark.asyncio
async def test_trigger_run_requires_approval_and_records_a_queued_run():
    policies = Policies(decision="require_approval")
    gateway = CiGateway(policies, admin=None, cipher=None, github_api_url="https://api.github.com")

    result = await gateway.trigger_run("user-1", "workspace-1", CONNECTION, "ci.yml", "main")

    assert result == {"status": "approval_required", "approval_id": "approval-1"}
    assert policies.trigger_runs[0]["status"] == "queued"
    assert policies.trigger_runs[0]["approval_request_id"] == "approval-1"
    assert policies.approvals == [("user-1", "workspace-1", "pipeline.run.trigger", "Trigger ci.yml@main on acme/widgets")]


@pytest.mark.asyncio
async def test_trigger_run_reports_unavailable_when_no_token_is_registered():
    policies = Policies(decision="allow")
    gateway = CiGateway(policies, admin=FakeAdminTable([]), cipher=FakeCipher(), github_api_url="https://api.github.com")

    result = await gateway.trigger_run("user-1", "workspace-1", CONNECTION, "ci.yml")

    assert result == {"status": "unavailable", "reason": "No GitHub token is registered for this CI connection."}
    assert policies.updated_runs[0][1] == "failed"


@pytest.mark.asyncio
async def test_trigger_run_allowed_dispatches_a_workflow_dispatch_and_marks_succeeded():
    calls = []

    class FakeResponse:
        def raise_for_status(self):
            pass

    class FakeClient:
        async def post(self, url, json, headers):
            calls.append((url, json, headers))
            return FakeResponse()

    policies = Policies(decision="allow")
    admin = FakeAdminTable([{"encrypted_secret": "encrypted:gh-token"}])
    gateway = CiGateway(policies, admin=admin, cipher=FakeCipher(), github_api_url="https://api.github.com", client=FakeClient())

    result = await gateway.trigger_run("user-1", "workspace-1", CONNECTION, "ci.yml", "main")

    assert result == {"status": "completed"}
    assert calls == [
        (
            "https://api.github.com/repos/acme/widgets/actions/workflows/ci.yml/dispatches",
            {"ref": "main"},
            {"Authorization": "Bearer gh-token", "Accept": "application/vnd.github+json"},
        )
    ]
    assert policies.updated_runs == [(policies.trigger_runs[0]["id"], "succeeded", None)]


@pytest.mark.asyncio
async def test_trigger_run_marks_failed_when_github_rejects_the_dispatch():
    import httpx

    class FakeClient:
        async def post(self, *args, **kwargs):
            raise httpx.ConnectError("connection refused")

    policies = Policies(decision="allow")
    admin = FakeAdminTable([{"encrypted_secret": "encrypted:gh-token"}])
    gateway = CiGateway(policies, admin=admin, cipher=FakeCipher(), github_api_url="https://api.github.com", client=FakeClient())

    result = await gateway.trigger_run("user-1", "workspace-1", CONNECTION, "ci.yml")

    assert result["status"] == "failed"
    assert policies.updated_runs[0][1] == "failed"


@pytest.mark.asyncio
async def test_dispatch_after_approval_uses_the_stored_trigger_run():
    calls = []

    class FakeResponse:
        def raise_for_status(self):
            pass

    class FakeClient:
        async def post(self, url, json, headers):
            calls.append((url, json))
            return FakeResponse()

    policies = Policies(decision="allow")
    admin = FakeAdminTable([{"encrypted_secret": "encrypted:gh-token"}])
    gateway = CiGateway(policies, admin=admin, cipher=FakeCipher(), github_api_url="https://api.github.com", client=FakeClient())
    trigger_run = {"id": "run-1", "workflow_ref": "deploy.yml", "git_ref": "release"}

    result = await gateway.dispatch_after_approval("user-1", "workspace-1", trigger_run, CONNECTION)

    assert result == {"status": "completed"}
    assert calls == [("https://api.github.com/repos/acme/widgets/actions/workflows/deploy.yml/dispatches", {"ref": "release"})]
    assert policies.updated_runs == [("run-1", "succeeded", None)]
