import pytest

from app.services.infra_gateway import InfraGateway, InfraGatewayError

CONNECTION = {"id": "conn-1", "kind": "docker_host", "name": "prod-host", "manifest": {"host": "tcp://10.0.0.5:2376"}}


class Policies:
    def __init__(self, decision="allow"):
        self.decision = decision
        self.approvals = []
        self.audits = []
        self.action_runs = []
        self.updated_runs = []

    def policy_decision(self, _workspace_id, _action):
        return self.decision

    def create_approval_request(self, user_id, workspace_id, action, summary):
        approval = {"id": "approval-1", "action": action, "summary": summary}
        self.approvals.append((user_id, workspace_id, action, summary))
        return approval

    def record_tool_event(self, user_id, workspace_id, action, details):
        self.audits.append((user_id, workspace_id, action, details))

    def create_infra_action_run(self, user_id, workspace_id, infra_connection_id, action, resource_type, resource_ref, status, params, approval_request_id):
        run = {
            "id": f"run-{len(self.action_runs) + 1}",
            "workspace_id": workspace_id,
            "infra_connection_id": infra_connection_id,
            "action": action,
            "resource_type": resource_type,
            "resource_ref": resource_ref,
            "status": status,
            "params": params or {},
            "approval_request_id": approval_request_id,
            "requested_by": user_id,
        }
        self.action_runs.append(run)
        return run

    def update_infra_action_run(self, action_run_id, status, error=None):
        self.updated_runs.append((action_run_id, status, error))


@pytest.mark.asyncio
async def test_list_resources_denied_by_policy():
    policies = Policies(decision="deny")
    gateway = InfraGateway(policies, "http://infra-agent", "token")

    result = await gateway.list_resources("user-1", "workspace-1", CONNECTION, "container")

    assert result == {"status": "denied", "reason": "Workspace policy denied this action."}
    assert policies.audits == [("user-1", "workspace-1", "infra.container.list", {"status": "denied"})]


@pytest.mark.asyncio
async def test_list_resources_requires_approval_without_contacting_agent():
    policies = Policies(decision="require_approval")
    gateway = InfraGateway(policies, "http://infra-agent", "token")

    result = await gateway.list_resources("user-1", "workspace-1", CONNECTION, "pod")

    assert result == {"status": "approval_required", "approval_id": "approval-1"}
    assert policies.approvals == [("user-1", "workspace-1", "infra.pod.list", "List pods on prod-host")]


@pytest.mark.asyncio
async def test_list_resources_rejects_unknown_resource_type():
    policies = Policies(decision="allow")
    gateway = InfraGateway(policies, "http://infra-agent", "token")

    with pytest.raises(InfraGatewayError):
        await gateway.list_resources("user-1", "workspace-1", CONNECTION, "cluster")


@pytest.mark.asyncio
async def test_list_resources_reports_unavailable_when_agent_is_not_configured():
    policies = Policies(decision="allow")
    gateway = InfraGateway(policies, "", "")

    result = await gateway.list_resources("user-1", "workspace-1", CONNECTION, "container")

    assert result == {"status": "unavailable", "reason": "The infra agent is not configured."}


@pytest.mark.asyncio
async def test_list_resources_calls_the_agent_and_audits_completion():
    calls = []

    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {"items": [{"id": "c1", "name": "web"}]}

    class FakeClient:
        async def post(self, url, json, headers):
            calls.append((url, json, headers))
            return FakeResponse()

    policies = Policies(decision="allow")
    gateway = InfraGateway(policies, "http://infra-agent", "secret-token", client=FakeClient())

    result = await gateway.list_resources("user-1", "workspace-1", CONNECTION, "container")

    assert result == {"status": "completed", "items": [{"id": "c1", "name": "web"}]}
    assert calls == [("http://infra-agent/containers", {"kind": "docker_host", "manifest": CONNECTION["manifest"]}, {"X-Orbital-Infra-Token": "secret-token"})]
    assert policies.audits == [("user-1", "workspace-1", "infra.container.list", {"status": "completed"})]


@pytest.mark.asyncio
async def test_logs_rejects_unsupported_resource_type():
    policies = Policies(decision="allow")
    gateway = InfraGateway(policies, "http://infra-agent", "token")

    with pytest.raises(InfraGatewayError):
        await gateway.logs("user-1", "workspace-1", CONNECTION, "deployment", "web-1")


@pytest.mark.asyncio
async def test_execute_action_rejects_an_unsupported_action_for_the_resource_type():
    policies = Policies(decision="allow")
    gateway = InfraGateway(policies, "http://infra-agent", "token")

    with pytest.raises(InfraGatewayError):
        await gateway.execute_action("user-1", "workspace-1", CONNECTION, "container", "web-1", "scale")


@pytest.mark.asyncio
async def test_execute_action_denied_by_policy_records_a_failed_run_without_contacting_the_agent():
    calls = []

    class FakeClient:
        async def post(self, *args, **kwargs):
            calls.append((args, kwargs))

    policies = Policies(decision="deny")
    gateway = InfraGateway(policies, "http://infra-agent", "token", client=FakeClient())

    result = await gateway.execute_action("user-1", "workspace-1", CONNECTION, "container", "web-1", "restart")

    assert result == {"status": "denied", "reason": "Workspace policy denied this action."}
    assert calls == []
    assert policies.action_runs[0]["status"] == "failed"
    assert policies.action_runs[0]["approval_request_id"] is None


@pytest.mark.asyncio
async def test_execute_action_requires_approval_and_records_a_queued_run_linked_to_it():
    policies = Policies(decision="require_approval")
    gateway = InfraGateway(policies, "http://infra-agent", "token")

    result = await gateway.execute_action("user-1", "workspace-1", CONNECTION, "deployment", "web", "scale", {"replicas": 3})

    assert result == {"status": "approval_required", "approval_id": "approval-1"}
    assert policies.action_runs[0]["status"] == "queued"
    assert policies.action_runs[0]["approval_request_id"] == "approval-1"
    assert policies.action_runs[0]["params"] == {"replicas": 3}
    assert policies.approvals == [("user-1", "workspace-1", "infra.deployment.scale", "Scale deployment web on prod-host")]


@pytest.mark.asyncio
async def test_execute_action_allowed_dispatches_immediately_and_marks_the_run_succeeded():
    calls = []

    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {"status": "ok"}

    class FakeClient:
        async def post(self, url, json, headers):
            calls.append((url, json, headers))
            return FakeResponse()

    policies = Policies(decision="allow")
    gateway = InfraGateway(policies, "http://infra-agent", "secret-token", client=FakeClient())

    result = await gateway.execute_action("user-1", "workspace-1", CONNECTION, "container", "web-1", "restart")

    assert result == {"status": "completed"}
    assert calls == [("http://infra-agent/containers/action", {"kind": "docker_host", "manifest": CONNECTION["manifest"], "resource_ref": "web-1", "action": "restart"}, {"X-Orbital-Infra-Token": "secret-token"})]
    assert policies.updated_runs == [(policies.action_runs[0]["id"], "succeeded", None)]


@pytest.mark.asyncio
async def test_execute_action_marks_the_run_failed_when_the_agent_call_raises():
    import httpx

    class FakeClient:
        async def post(self, *args, **kwargs):
            raise httpx.ConnectError("connection refused")

    policies = Policies(decision="allow")
    gateway = InfraGateway(policies, "http://infra-agent", "token", client=FakeClient())

    result = await gateway.execute_action("user-1", "workspace-1", CONNECTION, "container", "web-1", "stop")

    assert result["status"] == "failed"
    assert policies.updated_runs[0][1] == "failed"


@pytest.mark.asyncio
async def test_dispatch_after_approval_calls_the_agent_using_the_stored_action_run():
    calls = []

    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {"status": "ok"}

    class FakeClient:
        async def post(self, url, json, headers):
            calls.append((url, json))
            return FakeResponse()

    policies = Policies(decision="allow")
    gateway = InfraGateway(policies, "http://infra-agent", "token", client=FakeClient())
    action_run = {"id": "run-1", "action": "infra.pod.delete", "resource_type": "pod", "resource_ref": "web-abc123", "params": {}}

    result = await gateway.dispatch_after_approval("user-1", "workspace-1", action_run, CONNECTION)

    assert result == {"status": "completed"}
    assert calls == [("http://infra-agent/pods/action", {"kind": "docker_host", "manifest": CONNECTION["manifest"], "resource_ref": "web-abc123", "action": "delete"})]
    assert policies.updated_runs == [("run-1", "succeeded", None)]
