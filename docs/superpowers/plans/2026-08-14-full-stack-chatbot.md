# Full-stack chatbot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React and FastAPI chatbot with Supabase auth/history and streamed OpenRouter replies.

**Architecture:** A Vite React client authenticates through Supabase and calls a FastAPI JSON/streaming API with its bearer token. The API delegates conversation persistence to repositories and generation to an OpenRouter service, keeping the provider key on the server. Supabase holds authenticated user-owned conversations and messages.

**Tech Stack:** React, TypeScript, Vite, FastAPI, Python, pytest, Supabase PostgreSQL/Auth, OpenAI Python SDK configured for OpenRouter.

## Global Constraints

- `OPENROUTER_API_KEY` exists only in `server/.env`.
- The client uses Supabase email-and-password authentication.
- A user can read or write only their own conversations.
- The initial product excludes files, RAG, tool use, voice, moderation dashboards, and social messaging.

---

## File structure

```text
client/src/
  api/chat.ts                 HTTP and stream client
  components/AuthScreen.tsx   sign-in and sign-up UI
  components/ChatApp.tsx      conversation and message UI
  lib/supabase.ts             browser Supabase client
  App.tsx                     session boundary
server/app/
  api/chat.py                 FastAPI endpoints
  core/config.py              environment settings
  models/chat.py              request/response models
  repositories/chat.py        Supabase data access
  services/chat.py            chat orchestration
  services/openrouter.py      provider streaming
  main.py                     application factory
supabase/schema.sql           tables and RLS policies
```

### Task 1: FastAPI health endpoint and configuration

**Files:**
- Create: `server/app/core/config.py`, `server/app/main.py`, `server/tests/test_health.py`, `server/requirements.txt`, `server/.env.example`

**Interfaces:**
- Produces: `create_app() -> FastAPI` with `GET /health` returning `{"status": "ok"}`.

- [ ] **Step 1: Write the failing test**

```python
from fastapi.testclient import TestClient
from app.main import create_app

def test_health_returns_ok():
    response = TestClient(create_app()).get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 2: Run it to verify failure**

Run: `cd server && pytest tests/test_health.py -v`
Expected: FAIL because `app.main` does not exist.

- [ ] **Step 3: Implement the smallest app**

```python
from fastapi import FastAPI

def create_app() -> FastAPI:
    app = FastAPI(title="Chatbot API")

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app

app = create_app()
```

- [ ] **Step 4: Run the test**

Run: `cd server && pytest tests/test_health.py -v`
Expected: PASS.

### Task 2: OpenRouter streaming service

**Files:**
- Create: `server/app/services/openrouter.py`, `server/tests/test_openrouter.py`

**Interfaces:**
- Produces: `OpenRouterService.stream_reply(messages: list[dict[str, str]]) -> AsyncIterator[str]`.

- [ ] **Step 1: Write the failing test**

```python
import pytest
from app.services.openrouter import OpenRouterService

class FakeCompletions:
    async def create(self, **_):
        return [type("Chunk", (), {"choices": [type("Choice", (), {"delta": type("Delta", (), {"content": "Hello"})()})()]})()]

@pytest.mark.asyncio
async def test_stream_reply_yields_nonempty_content():
    service = OpenRouterService(client=type("Client", (), {"chat": type("Chat", (), {"completions": FakeCompletions()})()})())
    assert [part async for part in service.stream_reply([])] == ["Hello"]
```

- [ ] **Step 2: Run it to verify failure**

Run: `cd server && pytest tests/test_openrouter.py -v`
Expected: FAIL because `OpenRouterService` does not exist.

- [ ] **Step 3: Implement the service**

```python
class OpenRouterService:
    def __init__(self, client):
        self.client = client

    async def stream_reply(self, messages):
        stream = await self.client.chat.completions.create(model="nvidia/nemotron-3.5-lightning:free", messages=messages, stream=True)
        for chunk in stream:
            content = chunk.choices[0].delta.content
            if content:
                yield content
```

- [ ] **Step 4: Run the test**

Run: `cd server && pytest tests/test_openrouter.py -v`
Expected: PASS.

### Task 3: Conversation ownership repository and chat service

**Files:**
- Create: `server/app/repositories/chat.py`, `server/app/services/chat.py`, `server/tests/test_chat_service.py`

**Interfaces:**
- Produces: `ChatService.reply(user_id: str, conversation_id: str, content: str) -> AsyncIterator[str]`.
- Consumes: repository methods `owns_conversation`, `add_message`; `OpenRouterService.stream_reply`.

- [ ] **Step 1: Write the failing test**

```python
import pytest
from app.services.chat import ChatService

@pytest.mark.asyncio
async def test_reply_saves_user_and_completed_assistant_reply():
    saved = []
    repo = type("Repo", (), {"owns_conversation": lambda *_: True, "add_message": lambda _, cid, role, content: saved.append((cid, role, content))})()
    ai = type("AI", (), {"stream_reply": lambda *_: stream(["Hi", "!"])})()
    service = ChatService(repo, ai)
    assert [part async for part in service.reply("u1", "c1", "Hello")] == ["Hi", "!"]
    assert saved == [("c1", "user", "Hello"), ("c1", "assistant", "Hi!")]
```

- [ ] **Step 2: Run it to verify failure**

Run: `cd server && pytest tests/test_chat_service.py -v`
Expected: FAIL because `ChatService` does not exist.

- [ ] **Step 3: Implement the service and repository contract**

```python
class ChatService:
    def __init__(self, repository, ai):
        self.repository, self.ai = repository, ai

    async def reply(self, user_id, conversation_id, content):
        if not self.repository.owns_conversation(user_id, conversation_id):
            raise PermissionError
        self.repository.add_message(conversation_id, "user", content)
        answer = ""
        async for part in self.ai.stream_reply([]):
            answer += part
            yield part
        self.repository.add_message(conversation_id, "assistant", answer)
```

- [ ] **Step 4: Run the test**

Run: `cd server && pytest tests/test_chat_service.py -v`
Expected: PASS.

### Task 4: Authenticated FastAPI chat endpoints

**Files:**
- Create: `server/app/api/chat.py`, `server/app/models/chat.py`, `server/tests/test_chat_api.py`
- Modify: `server/app/main.py`

**Interfaces:**
- Produces: `POST /chat` returning `text/plain` stream; `401` without a bearer token; `403` for another user's conversation.

- [ ] **Step 1: Write the failing test**

```python
from fastapi.testclient import TestClient
from app.main import create_app

def test_chat_requires_bearer_token():
    response = TestClient(create_app()).post("/chat", json={"conversation_id": "c1", "content": "Hello"})
    assert response.status_code == 401
```

- [ ] **Step 2: Run it to verify failure**

Run: `cd server && pytest tests/test_chat_api.py -v`
Expected: FAIL because `/chat` is not registered.

- [ ] **Step 3: Implement route authentication**

```python
@router.post("/chat")
async def chat(request: ChatRequest, authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing access token")
    return StreamingResponse(service.reply(user_id_from_token(authorization[7:]), request.conversation_id, request.content), media_type="text/plain")
```

- [ ] **Step 4: Run the test**

Run: `cd server && pytest tests/test_chat_api.py -v`
Expected: PASS.

### Task 5: Supabase schema and repository implementation

**Files:**
- Create: `supabase/schema.sql`
- Modify: `server/app/repositories/chat.py`, `server/.env.example`

**Interfaces:**
- Produces: owner-filtered `list_conversations`, `create_conversation`, `list_messages`, `owns_conversation`, and `add_message` repository operations.

- [ ] **Step 1: Write the failing repository test**

```python
def test_conversation_query_is_scoped_to_user(fake_table):
    repository = SupabaseChatRepository(fake_table)
    repository.list_conversations("user-1")
    assert fake_table.filters == [("user_id", "user-1")]
```

- [ ] **Step 2: Run it to verify failure**

Run: `cd server && pytest tests/test_repository.py -v`
Expected: FAIL because `SupabaseChatRepository` does not exist.

- [ ] **Step 3: Implement SQL and repository**

```sql
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New chat',
  created_at timestamptz not null default now()
);
alter table public.conversations enable row level security;
create policy "users manage own conversations" on public.conversations
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
```

- [ ] **Step 4: Run the test**

Run: `cd server && pytest tests/test_repository.py -v`
Expected: PASS.

### Task 6: React authentication and chat screen

**Files:**
- Create: `client/src/lib/supabase.ts`, `client/src/api/chat.ts`, `client/src/components/AuthScreen.tsx`, `client/src/components/ChatApp.tsx`, `client/src/components/ChatApp.test.tsx`
- Modify: `client/src/App.tsx`, `client/src/index.css`, `client/.env.example`

**Interfaces:**
- Produces: authenticated chat UI that sends `conversation_id` and message content with the Supabase access token and appends streamed text.

- [ ] **Step 1: Write the failing component test**

```tsx
it('sends typed text and shows the streamed assistant reply', async () => {
  render(<ChatApp session={session} api={fakeApi} />)
  await userEvent.type(screen.getByLabelText('Message'), 'Hello')
  await userEvent.click(screen.getByRole('button', { name: 'Send' }))
  expect(await screen.findByText('Hi!')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run it to verify failure**

Run: `cd client && npm test -- --run src/components/ChatApp.test.tsx`
Expected: FAIL because `ChatApp` does not exist.

- [ ] **Step 3: Implement the minimal UI**

```tsx
for await (const chunk of api.sendMessage(session.access_token, conversationId, text)) {
  setMessages((items) => appendToAssistant(items, chunk))
}
```

- [ ] **Step 4: Run the test and production build**

Run: `cd client && npm test -- --run src/components/ChatApp.test.tsx && npm run build`
Expected: PASS and successful build.

### Task 7: Environment documentation and full verification

**Files:**
- Create: `README.md`

**Interfaces:**
- Produces: setup instructions for Supabase URL/key, OpenRouter key, schema application, API start command, and client start command.

- [ ] **Step 1: Document required variables**

```text
server/.env: OPENROUTER_API_KEY, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY
client/.env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_API_URL
```

- [ ] **Step 2: Run all backend tests**

Run: `cd server && pytest -v`
Expected: PASS.

- [ ] **Step 3: Run the frontend test suite and build**

Run: `cd client && npm test -- --run && npm run build`
Expected: PASS and successful build.
