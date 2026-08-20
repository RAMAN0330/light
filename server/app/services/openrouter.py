from collections.abc import AsyncIterator
import json
from typing import Awaitable, Callable, Optional

from openai import AsyncOpenAI

from app.core.config import settings


class OpenRouterService:
    def __init__(self, client=None, model: str = settings.openrouter_model, api_key: Optional[str] = None) -> None:
        self.client = client or AsyncOpenAI(
            base_url="https://openrouter.ai/api/v1", api_key=api_key or settings.openrouter_api_key
        )
        self.model = model

    async def stream_reply(self, messages: list[dict[str, str]]) -> AsyncIterator[str]:
        stream = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            stream=True,
            extra_body={"reasoning": {"effort": "none"}},
        )
        async for chunk in stream:
            content = chunk.choices[0].delta.content
            if content:
                yield content

    async def reply_with_tools(
        self,
        messages: list[dict],
        tools: list[dict],
        execute: Callable[[str, dict], Awaitable[dict]],
    ) -> AsyncIterator[str]:
        """Run a bounded OpenAI-compatible tool loop, then yield the final answer."""
        transcript = list(messages)
        for _ in range(4):
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=transcript,
                tools=tools,
                tool_choice="auto",
                stream=False,
                extra_body={"reasoning": {"effort": "none"}},
            )
            message = response.choices[0].message
            calls = getattr(message, "tool_calls", None) or []
            if not calls:
                if message.content:
                    yield message.content
                return
            transcript.append(message.model_dump())
            for call in calls:
                try:
                    payload = json.loads(call.function.arguments)
                except (TypeError, json.JSONDecodeError):
                    payload = {}
                try:
                    result = await execute(call.function.name, payload)
                except Exception as error:
                    result = {"status": "error", "reason": str(error)}
                transcript.append({"role": "tool", "tool_call_id": call.id, "content": json.dumps(result)})
        yield "Tool execution limit reached. Please refine the request."
