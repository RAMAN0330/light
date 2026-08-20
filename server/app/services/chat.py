from collections.abc import AsyncIterator

from app.services.upstream_skills import resolve_published_skills
from app.services.tool_calling import tool_definitions


class ChatService:
    def __init__(self, repository, ai, tool_gateway=None) -> None:
        self.repository = repository
        self.ai = ai
        self.tool_gateway = tool_gateway
        self.run_id = None

    async def reply(
        self, user_id: str, conversation_id: str, content: str, mode: str = "ask"
    ) -> AsyncIterator[str]:
        if not self.repository.owns_conversation(user_id, conversation_id):
            raise PermissionError("Conversation not found")

        run_id = getattr(self.repository, "start_agent_run", lambda *_: None)(
            user_id, conversation_id, mode
        )
        self.run_id = run_id
        self.repository.add_message(conversation_id, "user", content)
        answer = ""
        guidance = {
            "ask": "Give a direct, helpful answer. Use clear Markdown when it improves readability.",
            "research": "Be rigorous. Separate established facts from uncertainty, state assumptions, and suggest sources to verify.",
            "create": "Produce a practical, ready-to-use deliverable. Structure the result clearly and include next steps.",
        }[mode]
        project_context = getattr(self.repository, "project_instructions", lambda _id: "")(conversation_id)
        references = getattr(self.repository, "project_documents_for_conversation", lambda _id: "")(conversation_id)
        if references: project_context = f"{project_context}\n\n{references}"
        if project_context:
            guidance = f"{guidance}\n\nProject instructions: {project_context}"
        workspace_id = getattr(self.repository, "workspace_for_conversation", lambda _id: None)(conversation_id)
        skills = getattr(self.repository, "list_workspace_skills", lambda _id: [])(workspace_id) if workspace_id else []
        skill_guidance = resolve_published_skills(skills, content)
        if skill_guidance:
            guidance = f"{guidance}\n\n{skill_guidance}"
        messages = [{"role": "system", "content": guidance}, *self.repository.list_messages(conversation_id)]
        tools = tool_definitions(skills) if self.tool_gateway and workspace_id else []
        allowed_tools = {tool["function"]["name"] for tool in tools}
        try:
            if tools and hasattr(self.ai, "reply_with_tools"):
                async def execute_tool(name, payload):
                    if name not in allowed_tools:
                        return {"status": "denied", "reason": "Tool is not declared by this workspace."}
                    return await self.tool_gateway.execute(user_id, workspace_id, name, payload)
                reply = self.ai.reply_with_tools(messages, tools, execute_tool)
            else:
                reply = self.ai.stream_reply(messages)
            async for part in reply:
                if run_id and getattr(self.repository, "is_agent_run_cancelled", lambda _id: False)(run_id):
                    return
                answer += part
                yield part
            self.repository.add_message(conversation_id, "assistant", answer)
            if run_id:
                self.repository.finish_agent_run(run_id, "succeeded")
        except Exception as error:
            if run_id:
                self.repository.finish_agent_run(run_id, "failed", str(error))
            raise
