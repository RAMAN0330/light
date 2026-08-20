import pytest

from app.services.chat import ChatService


async def reply_parts():
    yield "Hi"
    yield "!"


class Repository:
    def __init__(self):
        self.saved = []
        self.runs = []

    def owns_conversation(self, user_id, conversation_id):
        return user_id == "user-1" and conversation_id == "chat-1"

    def add_message(self, conversation_id, role, content):
        self.saved.append((conversation_id, role, content))

    def list_messages(self, _conversation_id):
        return []

    def start_agent_run(self, user_id, conversation_id, mode):
        self.runs.append(("started", user_id, conversation_id, mode))
        return "run-1"

    def finish_agent_run(self, run_id, status, error=None):
        self.runs.append(("finished", run_id, status, error))


class AI:
    def stream_reply(self, _messages):
        return reply_parts()


@pytest.mark.asyncio
async def test_reply_saves_user_and_completed_assistant_reply():
    repository = Repository()
    service = ChatService(repository, AI())

    reply = [part async for part in service.reply("user-1", "chat-1", "Hello")]

    assert reply == ["Hi", "!"]
    assert repository.saved == [
        ("chat-1", "user", "Hello"),
        ("chat-1", "assistant", "Hi!"),
    ]
    assert repository.runs == [
        ("started", "user-1", "chat-1", "ask"),
        ("finished", "run-1", "succeeded", None),
    ]


@pytest.mark.asyncio
async def test_reply_rejects_a_conversation_not_owned_by_user():
    with pytest.raises(PermissionError):
        service = ChatService(Repository(), AI())
        [part async for part in service.reply("other-user", "chat-1", "Hello")]


@pytest.mark.asyncio
async def test_reply_adds_published_workspace_skill_guidance():
    captured = []

    class SkillRepository(Repository):
        def workspace_for_conversation(self, _conversation_id):
            return "workspace-1"

        def list_workspace_skills(self, _workspace_id):
            return [{"name": "Research", "status": "published", "manifest": {"instructions": "Cite sources.", "tools": ["web.search"], "data_access": ["workspace.knowledge.read"]}}]

    class CapturingAI:
        async def stream_reply(self, messages):
            captured.extend(messages)
            yield "Done"

    service = ChatService(SkillRepository(), CapturingAI())
    [part async for part in service.reply("user-1", "chat-1", "Research this")]

    assert "Cite sources." in captured[0]["content"]


@pytest.mark.asyncio
async def test_reply_passes_only_published_skill_tools_to_a_tool_capable_model():
    captured = []

    class SkillRepository(Repository):
        def workspace_for_conversation(self, _conversation_id): return "workspace-1"
        def list_workspace_skills(self, _workspace_id):
            return [{"name": "Research", "status": "published", "manifest": {"tools": ["plugin.agent-reach.invoke"]}}]

    class ToolAI:
        async def reply_with_tools(self, messages, tools, _execute):
            captured.extend(tools)
            yield "Research complete"

    service = ChatService(SkillRepository(), ToolAI(), tool_gateway=object())
    assert [part async for part in service.reply("user-1", "chat-1", "Research this")] == ["Research complete"]
    assert captured[0]["function"]["name"] == "orbital_web_research"


@pytest.mark.asyncio
async def test_reply_denies_a_tool_not_declared_by_workspace_skills():
    results = []

    class SkillRepository(Repository):
        def workspace_for_conversation(self, _conversation_id): return "workspace-1"
        def list_workspace_skills(self, _workspace_id):
            return [{"name": "Research", "status": "published", "manifest": {"tools": ["plugin.agent-reach.invoke"]}}]

    class ToolAI:
        async def reply_with_tools(self, _messages, _tools, execute):
            results.append(await execute("orbital_code_context", {"arguments": ["query"]}))
            yield "Done"

    class Gateway:
        async def execute(self, *_args):
            raise AssertionError("undeclared tool must not reach the gateway")

    service = ChatService(SkillRepository(), ToolAI(), tool_gateway=Gateway())
    [part async for part in service.reply("user-1", "chat-1", "Research this")]
    assert results == [{"status": "denied", "reason": "Tool is not declared by this workspace."}]
