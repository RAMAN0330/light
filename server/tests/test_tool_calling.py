import pytest


def test_published_skill_tools_become_orbital_function_schemas():
    from app.services.tool_calling import tool_definitions

    tools = tool_definitions([
        {"status": "published", "manifest": {"tools": ["plugin.agent-reach.invoke"]}},
        {"status": "draft", "manifest": {"tools": ["plugin.graphify.invoke"]}},
    ])

    assert [tool["function"]["name"] for tool in tools] == ["orbital_web_research"]
    assert tools[0]["function"]["parameters"]["required"] == ["query"]


@pytest.mark.asyncio
async def test_tool_gateway_requires_approval_before_contacting_runner():
    from app.services.tool_calling import ToolGateway

    class Policies:
        def policy_decision(self, _workspace_id, _action): return "require_approval"
        def create_approval_request(self, _user_id, _workspace_id, action, _summary): return {"id": "approval-1", "action": action}

    gateway = ToolGateway(Policies(), "http://runner")
    result = await gateway.execute("user-1", "workspace-1", "orbital_web_research", {"query": "orbital"})

    assert result == {"status": "approval_required", "approval_id": "approval-1"}


@pytest.mark.asyncio
async def test_tool_gateway_rejects_undeclared_or_unsafe_arguments():
    from app.services.tool_calling import ToolGateway, ToolCallError

    class Policies:
        def policy_decision(self, *_args): return "allow"

    gateway = ToolGateway(Policies(), "http://runner")
    with pytest.raises(ToolCallError):
        await gateway.execute("user-1", "workspace-1", "not_orbital", {"query": "x"})
    with pytest.raises(ToolCallError):
        await gateway.execute("user-1", "workspace-1", "orbital_web_research", {"query": "; rm -rf /"})
