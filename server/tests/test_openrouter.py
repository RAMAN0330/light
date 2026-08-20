import pytest

from app.services.openrouter import OpenRouterService


class Client:
    request = None

    class Chat:
        class Completions:
            async def create(self, **kwargs):
                Client.request = kwargs
                chunk = type(
                    "Chunk",
                    (),
                    {"choices": [type("Choice", (), {"delta": type("Delta", (), {"content": "Hello"})()})()]},
                )()
                return AsyncStream([chunk])

        completions = Completions()

    chat = Chat()


class AsyncStream:
    def __init__(self, chunks):
        self.chunks = iter(chunks)

    def __aiter__(self):
        return self

    async def __anext__(self):
        try:
            return next(self.chunks)
        except StopIteration:
            raise StopAsyncIteration


@pytest.mark.asyncio
async def test_stream_reply_yields_nonempty_content():
    service = OpenRouterService(client=Client())

    assert [part async for part in service.stream_reply([])] == ["Hello"]
    assert Client.request["extra_body"] == {"reasoning": {"effort": "none"}}


@pytest.mark.asyncio
async def test_reply_with_tools_executes_model_requested_tool_then_returns_answer():
    class ToolClient:
        calls = 0

        class Chat:
            class Completions:
                async def create(self, **_kwargs):
                    ToolClient.calls += 1
                    if ToolClient.calls == 1:
                        function = type("Function", (), {"name": "orbital_web_research", "arguments": '{"query":"orbital"}'})()
                        tool_call = type("ToolCall", (), {"id": "call-1", "function": function, "type": "function"})()
                        message = type("Message", (), {"content": None, "tool_calls": [tool_call], "model_dump": lambda self: {"role": "assistant", "tool_calls": []}})()
                    else:
                        message = type("Message", (), {"content": "Research complete", "tool_calls": [], "model_dump": lambda self: {"role": "assistant", "content": "Research complete"}})()
                    return type("Response", (), {"choices": [type("Choice", (), {"message": message})()]})()

            completions = Completions()

        chat = Chat()

    invoked = []

    async def execute(name, payload):
        invoked.append((name, payload))
        return {"status": "completed", "output": "sources"}

    service = OpenRouterService(client=ToolClient())
    tools = [{"type": "function", "function": {"name": "orbital_web_research", "parameters": {}}}]
    assert [part async for part in service.reply_with_tools([], tools, execute)] == ["Research complete"]
    assert invoked == [("orbital_web_research", {"query": "orbital"})]
