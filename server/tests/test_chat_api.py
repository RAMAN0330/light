from fastapi.testclient import TestClient

from app.main import create_app
from app.api.chat import current_user


def test_chat_requires_bearer_token():
    response = TestClient(create_app()).post(
        "/chat", json={"conversation_id": "chat-1", "content": "Hello"}
    )

    assert response.status_code == 401


def test_current_user_reads_subject_from_verified_claims():
    auth = type(
        "Auth",
        (),
        {"get_claims": lambda _self, _token: type("Claims", (), {"claims": {"sub": "user-1"}})()},
    )()
    request = type("Request", (), {"app": type("App", (), {"state": type("State", (), {"supabase": type("Supabase", (), {"auth": auth})()})()})()})()

    assert current_user(request, "Bearer user-access-token") == "user-1"


def test_current_user_reads_subject_from_dictionary_claims():
    auth = type(
        "Auth", (), {"get_claims": lambda _self, _token: {"claims": {"sub": "user-2"}}}
    )()
    request = type("Request", (), {"app": type("App", (), {"state": type("State", (), {"supabase": type("Supabase", (), {"auth": auth})()})()})()})()

    assert current_user(request, "Bearer user-access-token") == "user-2"


def test_create_project_persists_the_selected_repository_connection():
    app = create_app()
    created = []
    repository = type(
        "Repository",
        (),
        {
            "can_access_repository_connection": lambda *_: True,
            "create_project": lambda _self, user_id, name, instructions, repository_connection_id: created.append(
                (user_id, name, instructions, repository_connection_id)
            )
            or {"id": "project-1", "name": name, "instructions": instructions, "repository_connection_id": repository_connection_id},
        },
    )()
    app.state.supabase = type("Supabase", (), {"auth": type("Auth", (), {"get_claims": lambda *_: {"claims": {"sub": "user-1"}}})()})()
    app.state.repository_for_token = lambda _token: repository

    response = TestClient(app).post(
        "/projects",
        headers={"Authorization": "Bearer user-token"},
        json={"name": "Orbital", "instructions": "Ship it", "repository_connection_id": "repo-1"},
    )

    assert response.status_code == 200
    assert created == [("user-1", "Orbital", "Ship it", "repo-1")]
    assert response.json()["repository_connection_id"] == "repo-1"


def test_chat_websocket_sends_each_generated_delta():
    app = create_app()

    async def stream_reply(_self, _messages):
        yield "Hello"
        yield " world"

    repository = type(
        "Repository",
        (),
        {
            "owns_conversation": lambda *_: True,
            "add_message": lambda *_: None,
            "list_messages": lambda *_: [],
        },
    )()
    app.state.supabase = type(
        "Supabase",
        (),
        {"auth": type("Auth", (), {"get_claims": lambda *_: {"claims": {"sub": "user-1"}}})()},
    )()
    app.state.repository_for_token = lambda _token: repository
    app.state.ai = type("AI", (), {"stream_reply": stream_reply})()

    with TestClient(app).websocket_connect("/ws/chat") as socket:
        socket.send_json({"access_token": "user-token", "conversation_id": "chat-1", "content": "Hi"})
        assert socket.receive_json() == {"type": "delta", "text": "Hello"}
        assert socket.receive_json() == {"type": "delta", "text": " world"}
        assert socket.receive_json() == {"type": "done"}


def test_chat_sse_emits_structured_run_delta_and_done_events():
    app = create_app()

    async def stream_reply(_self, _messages):
        yield "Hello"
        yield " world"

    repository = type(
        "Repository",
        (),
        {
            "owns_conversation": lambda *_: True,
            "add_message": lambda *_: None,
            "list_messages": lambda *_: [],
            "start_agent_run": lambda *_: "run-1",
            "finish_agent_run": lambda *_: None,
        },
    )()
    app.state.supabase = type(
        "Supabase",
        (),
        {"auth": type("Auth", (), {"get_claims": lambda *_: {"claims": {"sub": "user-1"}}})()},
    )()
    app.state.repository_for_token = lambda _token: repository
    app.state.ai = type("AI", (), {"stream_reply": stream_reply})()

    response = TestClient(app).post(
        "/chat",
        headers={"Authorization": "Bearer user-token"},
        json={"conversation_id": "chat-1", "content": "Hi"},
    )

    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.text == (
        'data: {"type": "run", "run_id": "run-1"}\n\n'
        'data: {"type": "delta", "text": "Hello"}\n\n'
        'data: {"type": "delta", "text": " world"}\n\n'
        'data: {"type": "done"}\n\n'
    )


def test_delete_conversation_is_scoped_to_the_authenticated_user():
    app = create_app()
    deleted = []
    repository = type(
        "Repository",
        (),
        {
            "owns_conversation": lambda *_: True,
            "delete_conversation": lambda _self, user_id, conversation_id: deleted.append((user_id, conversation_id)),
        },
    )()
    app.state.supabase = type(
        "Supabase",
        (),
        {"auth": type("Auth", (), {"get_claims": lambda *_: {"claims": {"sub": "user-1"}}})()},
    )()
    app.state.repository_for_token = lambda _token: repository

    response = TestClient(app).delete("/conversations/chat-1", headers={"Authorization": "Bearer user-token"})

    assert response.status_code == 204
    assert deleted == [("user-1", "chat-1")]


def test_rename_conversation_is_scoped_to_the_authenticated_user():
    app = create_app()
    renamed = []
    repository = type("Repository", (), {"owns_conversation": lambda *_: True, "rename_conversation": lambda _self, user_id, conversation_id, title: renamed.append((user_id, conversation_id, title))})()
    app.state.supabase = type("Supabase", (), {"auth": type("Auth", (), {"get_claims": lambda *_: {"claims": {"sub": "user-1"}}})()})()
    app.state.repository_for_token = lambda _token: repository

    response = TestClient(app).patch("/conversations/chat-1", headers={"Authorization": "Bearer user-token"}, json={"title": "Study plan"})

    assert response.status_code == 204
    assert renamed == [("user-1", "chat-1", "Study plan")]


def test_archive_conversation_is_scoped_to_the_authenticated_user():
    app = create_app()
    archived = []
    repository = type("Repository", (), {"owns_conversation": lambda *_: True, "archive_conversation": lambda _self, user_id, conversation_id: archived.append((user_id, conversation_id))})()
    app.state.supabase = type("Supabase", (), {"auth": type("Auth", (), {"get_claims": lambda *_: {"claims": {"sub": "user-1"}}})()})()
    app.state.repository_for_token = lambda _token: repository

    response = TestClient(app).post("/conversations/chat-1/archive", headers={"Authorization": "Bearer user-token"})

    assert response.status_code == 204
    assert archived == [("user-1", "chat-1")]


def test_lists_agent_runs_for_an_owned_conversation():
    app = create_app()
    repository = type(
        "Repository",
        (),
        {
            "owns_conversation": lambda *_: True,
            "list_agent_runs": lambda *_: [{"id": "run-1", "status": "succeeded", "mode": "ask"}],
        },
    )()
    app.state.supabase = type("Supabase", (), {"auth": type("Auth", (), {"get_claims": lambda *_: {"claims": {"sub": "user-1"}}})()})()
    app.state.repository_for_token = lambda _token: repository

    response = TestClient(app).get("/conversations/chat-1/runs", headers={"Authorization": "Bearer user-token"})

    assert response.status_code == 200
    assert response.json() == [{"id": "run-1", "status": "succeeded", "mode": "ask"}]


def test_chat_uses_the_workspace_provider_gateway_when_a_conversation_has_an_organization():
    app = create_app()

    async def stream_reply(_self, _messages):
        yield "From gateway"

    repository = type(
        "Repository",
        (),
        {
            "owns_conversation": lambda *_: True,
            "organization_for_conversation": lambda *_: "org-1",
            "add_message": lambda *_: None,
            "list_messages": lambda *_: [],
        },
    )()
    app.state.supabase = type("Supabase", (), {"auth": type("Auth", (), {"get_claims": lambda *_: {"claims": {"sub": "user-1"}}})()})()
    app.state.repository_for_token = lambda _token: repository
    app.state.ai = type("AI", (), {"stream_reply": lambda *_: (_ for _ in () )})()
    app.state.provider_gateway = type("Gateway", (), {"ai_for_organization": lambda *_: type("AI", (), {"stream_reply": stream_reply})()})()

    with TestClient(app).websocket_connect("/ws/chat") as socket:
        socket.send_json({"access_token": "user-token", "conversation_id": "chat-1", "content": "Hi"})
        assert socket.receive_json() == {"type": "delta", "text": "From gateway"}
        assert socket.receive_json() == {"type": "done"}


def test_websocket_announces_a_cancellable_agent_run():
    app = create_app()

    async def stream_reply(_self, _messages):
        yield "Working"

    repository = type("Repository", (), {"owns_conversation": lambda *_: True, "add_message": lambda *_: None, "list_messages": lambda *_: [], "start_agent_run": lambda *_: "run-1", "finish_agent_run": lambda *_: None})()
    app.state.supabase = type("Supabase", (), {"auth": type("Auth", (), {"get_claims": lambda *_: {"claims": {"sub": "user-1"}}})()})()
    app.state.repository_for_token = lambda _token: repository
    app.state.ai = type("AI", (), {"stream_reply": stream_reply})()

    with TestClient(app).websocket_connect("/ws/chat") as socket:
        socket.send_json({"access_token": "user-token", "conversation_id": "chat-1", "content": "Hi"})
        assert socket.receive_json() == {"type": "run", "run_id": "run-1"}
        assert socket.receive_json() == {"type": "delta", "text": "Working"}
        assert socket.receive_json() == {"type": "done"}


def test_user_can_cancel_their_running_agent_run():
    cancelled = []
    app = create_app()
    repository = type(
        "Repository",
        (),
        {
            "agent_run": lambda *_: {"requested_by": "user-1", "status": "running"},
            "cancel_agent_run": lambda _self, run_id: cancelled.append(run_id) or True,
        },
    )()
    app.state.supabase = type("Supabase", (), {"auth": type("Auth", (), {"get_claims": lambda *_: {"claims": {"sub": "user-1"}}})()})()
    app.state.repository_for_token = lambda _token: repository

    response = TestClient(app).post("/agent-runs/run-1/cancel", headers={"Authorization": "Bearer user-token"})

    assert response.status_code == 204
    assert cancelled == ["run-1"]
