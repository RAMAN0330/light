from fastapi.testclient import TestClient

import app.api.organizations as organizations_api
from app.main import create_app


def app_with_repository(repository):
    app = create_app()
    app.state.supabase = type(
        "Supabase",
        (),
        {
            "auth": type(
                "Auth", (), {"get_claims": lambda *_: {"claims": {"sub": "user-1"}}}
            )()
        },
    )()
    app.state.organization_repository_for_token = lambda _token: repository
    app.state.admin_supabase = None
    return app


def test_creates_an_organization_with_a_default_workspace():
    created = []
    repository = type(
        "Repository",
        (),
        {
            "create_organization": lambda _self, user_id, name: created.append(
                (user_id, name)
            )
            or {"id": "org-1", "name": name, "workspace": {"id": "workspace-1", "name": "Acme"}},
        },
    )()

    response = TestClient(app_with_repository(repository)).post(
        "/organizations",
        headers={"Authorization": "Bearer user-token"},
        json={"name": "Acme"},
    )

    assert response.status_code == 201
    assert response.json()["workspace"] == {"id": "workspace-1", "name": "Acme"}
    assert created == [("user-1", "Acme")]


def test_uses_the_server_repository_to_bootstrap_an_organization(monkeypatch):
    created = []
    repository = type(
        "Repository",
        (),
        {
            "create_organization": lambda _self, user_id, name: created.append(
                (user_id, name)
            )
            or {"id": "org-1", "name": name, "workspace": {"id": "workspace-1"}},
        },
    )()
    app = app_with_repository(type("UserRepository", (), {})())
    app.state.admin_supabase = object()
    monkeypatch.setattr(
        organizations_api, "SupabaseOrganizationRepository", lambda _client: repository
    )

    response = TestClient(app).post(
        "/organizations",
        headers={"Authorization": "Bearer user-token"},
        json={"name": "Acme"},
    )

    assert response.status_code == 201
    assert created == [("user-1", "Acme")]


def test_organization_failure_keeps_cors_headers():
    app = app_with_repository(type("UserRepository", (), {})())
    app.state.admin_supabase = type(
        "Admin", (), {"table": lambda *_: (_ for _ in ()).throw(RuntimeError("database down"))}
    )()

    response = TestClient(app, raise_server_exceptions=False).post(
        "/organizations",
        headers={
            "Authorization": "Bearer user-token",
            "Origin": "http://localhost:5173",
        },
        json={"name": "Acme"},
    )

    assert response.status_code == 500
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert response.json() == {"detail": "Unexpected server error"}


def test_lists_only_workspaces_available_to_the_authenticated_user():
    requested_users = []
    repository = type(
        "Repository",
        (),
        {
            "list_workspaces": lambda _self, user_id: requested_users.append(user_id)
            or [{"id": "workspace-1", "name": "Acme", "role": "owner"}],
        },
    )()

    response = TestClient(app_with_repository(repository)).get(
        "/workspaces", headers={"Authorization": "Bearer user-token"}
    )

    assert response.status_code == 200
    assert response.json() == [{"id": "workspace-1", "name": "Acme", "role": "owner"}]
    assert requested_users == ["user-1"]


def test_workspace_admin_can_invite_an_existing_user_to_this_workspace():
    invited = []
    repository = type("Repository", (), {"can_manage_workspace": lambda *_: True})()
    app = app_with_repository(repository)

    class Memberships:
        def upsert(self, payload):
            invited.append(payload)
            return self

        def execute(self):
            return self

    app.state.admin_supabase = type(
        "Admin",
        (),
        {
            "auth": type(
                "Auth",
                (),
                {"admin": type("AdminAuth", (), {"list_users": lambda *_args, **_kwargs: [type("User", (), {"id": "user-2", "email": "teammate@example.com"})()]})()},
            )(),
            "table": lambda *_args: Memberships(),
        },
    )()

    response = TestClient(app).post(
        "/workspaces/workspace-1/invites",
        headers={"Authorization": "Bearer user-token"},
        json={"email": "teammate@example.com"},
    )

    assert response.status_code == 204
    assert invited == [{"workspace_id": "workspace-1", "user_id": "user-2", "role": "member"}]


def test_cannot_create_a_conversation_in_an_unavailable_workspace():
    repository = type(
        "Repository",
        (),
        {"owns_workspace": lambda *_: False},
    )()
    app = create_app()
    app.state.supabase = type(
        "Supabase",
        (),
        {
            "auth": type(
                "Auth", (), {"get_claims": lambda *_: {"claims": {"sub": "user-1"}}}
            )()
        },
    )()
    app.state.repository_for_token = lambda _token: repository

    response = TestClient(app).post(
        "/conversations",
        headers={"Authorization": "Bearer user-token"},
        json={"workspace_id": "workspace-2"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Workspace not found"}


def test_does_not_expose_audit_events_for_an_unavailable_organization():
    repository = type("Repository", (), {"owns_organization": lambda *_: False})()
    app = app_with_repository(repository)

    response = TestClient(app).get(
        "/organizations/org-2/audit-events",
        headers={"Authorization": "Bearer user-token"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Organization not found"}


def test_does_not_expose_membership_administration_to_a_regular_member():
    repository = type("Repository", (), {"can_manage_organization": lambda *_: False})()
    app = app_with_repository(repository)

    response = TestClient(app).get(
        "/organizations/org-2/members",
        headers={"Authorization": "Bearer user-token"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Organization not found"}


def test_workspace_admin_can_create_a_queued_delegated_run():
    created = []
    repository = type(
        "Repository",
        (),
        {
            "agent_run_for_workspace": lambda *_: {"id": "parent-1", "workspace_id": "workspace-1", "conversation_id": "chat-1"},
            "can_manage_workspace": lambda *_: True,
            "create_delegated_run": lambda _self, user_id, parent, scope: created.append((user_id, parent, scope)) or {"id": "child-1", "parent_run_id": parent["id"], "status": "queued", "scope": scope},
        },
    )()
    response = TestClient(app_with_repository(repository)).post(
        "/agent-runs/parent-1/delegations",
        headers={"Authorization": "Bearer user-token"},
        json={"scope": "Collect source citations"},
    )
    assert response.status_code == 201
    assert response.json()["parent_run_id"] == "parent-1"
    assert created == [("user-1", {"id": "parent-1", "workspace_id": "workspace-1", "conversation_id": "chat-1"}, "Collect source citations")]


def test_member_cannot_create_a_delegated_run():
    repository = type("Repository", (), {"agent_run_for_workspace": lambda *_: {"id": "parent-1", "workspace_id": "workspace-1"}, "can_manage_workspace": lambda *_: False})()
    response = TestClient(app_with_repository(repository)).post(
        "/agent-runs/parent-1/delegations", headers={"Authorization": "Bearer user-token"}, json={"scope": "Collect source citations"}
    )
    assert response.status_code == 404


def test_workspace_admin_can_set_retention_and_read_usage_summary():
    saved = []
    repository = type(
        "Repository",
        (),
        {
            "can_manage_workspace": lambda *_: True,
            "set_retention_policy": lambda _self, user_id, workspace_id, days, hold: saved.append((user_id, workspace_id, days, hold)) or {"workspace_id": workspace_id, "retention_days": days, "legal_hold": hold},
            "owns_workspace": lambda *_: True,
            "usage_summary": lambda _self, workspace_id: {"workspace_id": workspace_id, "agent_runs": 3, "completed_runs": 2, "usage_units": 18},
        },
    )()
    app = app_with_repository(repository)
    set_response = TestClient(app).put(
        "/workspaces/workspace-1/retention", headers={"Authorization": "Bearer user-token"}, json={"retention_days": 90, "legal_hold": False}
    )
    usage_response = TestClient(app).get("/workspaces/workspace-1/usage", headers={"Authorization": "Bearer user-token"})
    assert set_response.status_code == 200
    assert usage_response.json()["usage_units"] == 18
    assert saved == [("user-1", "workspace-1", 90, False)]


def test_workspace_member_can_read_retention_policy():
    repository = type("Repository", (), {"owns_workspace": lambda *_: True, "retention_policy": lambda _self, workspace_id: {"workspace_id": workspace_id, "retention_days": 30, "legal_hold": False}})()
    response = TestClient(app_with_repository(repository)).get(
        "/workspaces/workspace-1/retention", headers={"Authorization": "Bearer user-token"}
    )
    assert response.status_code == 200
    assert response.json()["retention_days"] == 30


def test_workspace_member_can_inspect_schedule_execution_history():
    repository = type(
        "Repository",
        (),
        {
            "schedule": lambda *_: {"id": "schedule-1", "workspace_id": "workspace-1"},
            "owns_workspace": lambda *_: True,
            "list_schedule_executions": lambda *_: [{"id": "execution-1", "status": "pending_approval"}],
        },
    )()

    response = TestClient(app_with_repository(repository)).get(
        "/schedules/schedule-1/executions", headers={"Authorization": "Bearer user-token"}
    )

    assert response.status_code == 200
    assert response.json() == [{"id": "execution-1", "status": "pending_approval"}]


def test_cannot_request_approval_for_an_unavailable_workspace():
    repository = type("Repository", (), {"owns_workspace": lambda *_: False})()
    app = app_with_repository(repository)

    response = TestClient(app).post(
        "/workspaces/workspace-2/approval-requests",
        headers={"Authorization": "Bearer user-token"},
        json={"action": "connector.invoke", "summary": "Read a research source"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Workspace not found"}


def test_does_not_expose_provider_credentials_to_a_regular_member():
    repository = type("Repository", (), {"can_manage_organization": lambda *_: False})()
    app = app_with_repository(repository)

    response = TestClient(app).get(
        "/organizations/org-2/provider-credentials",
        headers={"Authorization": "Bearer user-token"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Organization not found"}


def test_organization_admin_registers_an_encrypted_provider_credential():
    inserted = []

    class Table:
        def insert(self, value):
            inserted.append(value)
            return self

        def execute(self):
            return type(
                "Result",
                (),
                {
                    "data": [
                        {
                            "id": "credential-1",
                            "label": "Primary OpenRouter",
                            "provider": "openrouter",
                            "model": "provider/model",
                            "created_by": "user-1",
                            "revoked_at": None,
                            "created_at": "2026-08-14T00:00:00Z",
                        }
                    ]
                },
            )()

    repository = type("Repository", (), {"can_manage_organization": lambda *_: True})()
    app = app_with_repository(repository)
    app.state.admin_supabase = type("Admin", (), {"table": lambda *_: Table()})()
    app.state.credential_cipher = type(
        "Cipher", (), {"encrypt": lambda _self, secret: f"encrypted:{secret}"}
    )()

    response = TestClient(app).post(
        "/organizations/org-1/provider-credentials",
        headers={"Authorization": "Bearer user-token"},
        json={
            "label": "Primary OpenRouter",
            "provider": "openrouter",
            "secret": "sk-private",
            "model": "provider/model",
        },
    )

    assert response.status_code == 201
    assert response.json() == {
        "id": "credential-1",
        "label": "Primary OpenRouter",
        "provider": "openrouter",
        "model": "provider/model",
        "created_by": "user-1",
        "revoked_at": None,
        "created_at": "2026-08-14T00:00:00Z",
    }
    assert inserted == [
        {
            "organization_id": "org-1",
            "label": "Primary OpenRouter",
            "provider": "openrouter",
            "encrypted_secret": "encrypted:sk-private",
            "model": "provider/model",
            "created_by": "user-1",
        }
    ]


def test_workspace_admin_registers_a_draft_skill_with_declared_permissions():
    created = []
    repository = type(
        "Repository",
        (),
        {
            "can_manage_workspace": lambda *_: True,
            "create_skill": lambda _self, user_id, workspace_id, name, version, manifest: created.append(
                (user_id, workspace_id, name, version, manifest)
            )
            or {
                "id": "skill-1",
                "workspace_id": workspace_id,
                "name": name,
                "version": version,
                "status": "draft",
                "manifest": manifest,
                "created_by": user_id,
            },
        },
    )()
    app = app_with_repository(repository)

    response = TestClient(app).post(
        "/workspaces/workspace-1/skills",
        headers={"Authorization": "Bearer user-token"},
        json={
            "name": "Read-only research",
            "version": "1.0.0",
            "manifest": {
                "tools": ["web.search"],
                "data_access": ["workspace.knowledge.read"],
            },
        },
    )

    assert response.status_code == 201
    assert response.json()["status"] == "draft"
    assert created == [
        (
            "user-1",
            "workspace-1",
            "Read-only research",
            "1.0.0",
            {"tools": ["web.search"], "data_access": ["workspace.knowledge.read"]},
        )
    ]


def test_rejects_skill_without_declared_tool_and_data_permissions():
    repository = type("Repository", (), {"can_manage_workspace": lambda *_: True})()
    app = app_with_repository(repository)

    response = TestClient(app).post(
        "/workspaces/workspace-1/skills",
        headers={"Authorization": "Bearer user-token"},
        json={"name": "Incomplete", "version": "1.0.0", "manifest": {}},
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "Skill manifest must declare tools and data_access lists"}


def test_workspace_member_can_list_workspace_skills():
    repository = type(
        "Repository",
        (),
        {
            "owns_workspace": lambda *_: True,
            "list_skills": lambda *_: [{"id": "skill-1", "name": "Read-only research", "status": "draft"}],
        },
    )()
    app = app_with_repository(repository)

    response = TestClient(app).get(
        "/workspaces/workspace-1/skills",
        headers={"Authorization": "Bearer user-token"},
    )

    assert response.status_code == 200
    assert response.json() == [{"id": "skill-1", "name": "Read-only research", "status": "draft"}]


def test_organization_member_can_export_audit_events_as_csv():
    repository = type(
        "Repository",
        (),
        {
            "owns_organization": lambda *_: True,
            "list_audit_events": lambda *_: [
                {
                    "id": "event-1",
                    "organization_id": "org-1",
                    "workspace_id": "workspace-1",
                    "actor_id": "user-1",
                    "action": "skill.created",
                    "resource_type": "skill",
                    "resource_id": "skill-1",
                    "details": {"name": "Read-only research"},
                    "created_at": "2026-08-14T00:00:00Z",
                }
            ],
        },
    )()
    app = app_with_repository(repository)

    response = TestClient(app).get(
        "/organizations/org-1/audit-events/export",
        headers={"Authorization": "Bearer user-token"},
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "skill.created" in response.text
    assert "Read-only research" in response.text


def test_workspace_admin_registers_a_disabled_mcp_connector():
    created = []
    repository = type(
        "Repository",
        (),
        {
            "can_manage_workspace": lambda *_: True,
            "create_connector": lambda _self, user_id, workspace_id, name, endpoint, manifest: created.append(
                (user_id, workspace_id, name, endpoint, manifest)
            )
            or {"id": "connector-1", "name": name, "endpoint": endpoint, "enabled": False, "manifest": manifest},
        },
    )()
    app = app_with_repository(repository)

    response = TestClient(app).post(
        "/workspaces/workspace-1/connectors",
        headers={"Authorization": "Bearer user-token"},
        json={
            "name": "Research MCP",
            "endpoint": "https://mcp.example.com",
            "manifest": {"tools": ["research.search"], "approval_class": "read"},
        },
    )

    assert response.status_code == 201
    assert response.json()["enabled"] is False
    assert created == [
        (
            "user-1",
            "workspace-1",
            "Research MCP",
            "https://mcp.example.com",
            {"tools": ["research.search"], "approval_class": "read"},
        )
    ]


def test_connector_registration_rejects_loopback_or_credentialed_endpoints():
    repository = type("Repository", (), {"can_manage_workspace": lambda *_: True})()
    app = app_with_repository(repository)

    for endpoint in ("http://127.0.0.1:8000", "https://user:password@mcp.example.com"):
        response = TestClient(app).post(
            "/workspaces/workspace-1/connectors",
            headers={"Authorization": "Bearer user-token"},
            json={
                "name": "Unsafe MCP",
                "endpoint": endpoint,
                "manifest": {"tools": ["research.search"], "approval_class": "read"},
            },
        )

        assert response.status_code == 422


def test_workspace_admin_can_enable_a_registered_connector():
    changed = []
    repository = type(
        "Repository",
        (),
        {
            "connector": lambda *_: {"workspace_id": "workspace-1"},
            "can_manage_workspace": lambda *_: True,
            "set_connector_enabled": lambda _self, connector_id, enabled: changed.append((connector_id, enabled)),
        },
    )()
    app = app_with_repository(repository)

    response = TestClient(app).patch(
        "/connectors/connector-1",
        headers={"Authorization": "Bearer user-token"},
        json={"enabled": True},
    )

    assert response.status_code == 204
    assert changed == [("connector-1", True)]


def test_workspace_admin_creates_a_governed_calendar_authorization_request():
    created = []
    repository = type(
        "Repository",
        (),
        {
            "can_manage_workspace": lambda *_: True,
            "policy_decision": lambda *_: "allow",
            "create_external_connection": lambda _self, user_id, workspace_id, provider, scopes: created.append(
                (user_id, workspace_id, provider, scopes)
            )
            or {"id": "connection-1", "provider": provider, "scopes": scopes, "status": "pending_authorization"},
        },
    )()

    response = TestClient(app_with_repository(repository)).post(
        "/workspaces/workspace-1/external-connections",
        headers={"Authorization": "Bearer user-token"},
        json={"provider": "google_calendar", "scopes": ["calendar.events.readonly"]},
    )

    assert response.status_code == 201
    assert response.json()["status"] == "pending_authorization"
    assert created == [("user-1", "workspace-1", "google_calendar", ["calendar.events.readonly"])]


def test_external_connection_authorization_requires_an_existing_policy_approval():
    approvals = []
    repository = type(
        "Repository",
        (),
        {
            "can_manage_workspace": lambda *_: True,
            "policy_decision": lambda *_: "require_approval",
            "create_approval_request": lambda _self, user_id, workspace_id, action, summary: approvals.append(
                (user_id, workspace_id, action, summary)
            )
            or {"id": "approval-1", "status": "pending"},
        },
    )()

    response = TestClient(app_with_repository(repository)).post(
        "/workspaces/workspace-1/external-connections",
        headers={"Authorization": "Bearer user-token"},
        json={"provider": "gmail", "scopes": ["gmail.readonly"]},
    )

    assert response.status_code == 202
    assert response.json()["approval"]["id"] == "approval-1"
    assert approvals == [("user-1", "workspace-1", "external_connection.authorize", "Authorize gmail with gmail.readonly")]


def test_workspace_admin_can_revoke_an_external_connection_without_provider_side_effects():
    revoked = []
    repository = type(
        "Repository",
        (),
        {
            "external_connection": lambda *_: {"workspace_id": "workspace-1", "status": "active"},
            "can_manage_workspace": lambda *_: True,
            "revoke_external_connection": lambda _self, connection_id: revoked.append(connection_id)
            or {"id": connection_id, "status": "revoked"},
        },
    )()

    response = TestClient(app_with_repository(repository)).post(
        "/external-connections/connection-1/revoke",
        headers={"Authorization": "Bearer user-token"},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "revoked"
    assert revoked == ["connection-1"]


def test_organization_admin_can_provision_a_member_with_a_limited_role():
    written = []

    class Table:
        def upsert(self, value):
            written.append(value)
            return self

        def execute(self):
            return type("Result", (), {"data": []})()

    repository = type("Repository", (), {"can_manage_organization": lambda *_: True})()
    app = app_with_repository(repository)
    app.state.admin_supabase = type("Admin", (), {"table": lambda *_: Table()})()

    response = TestClient(app).post(
        "/organizations/org-1/members",
        headers={"Authorization": "Bearer user-token"},
        json={"user_id": "user-2", "role": "viewer"},
    )

    assert response.status_code == 204
    assert written == [{"organization_id": "org-1", "user_id": "user-2", "role": "viewer"}]


def test_policy_decision_creates_an_approval_for_a_protected_action():
    approvals = []
    repository = type(
        "Repository",
        (),
        {
            "owns_workspace": lambda *_: True,
            "policy_decision": lambda *_: "require_approval",
            "create_approval_request": lambda _self, user_id, workspace_id, action, summary: approvals.append(
                (user_id, workspace_id, action, summary)
            )
            or {"id": "approval-1", "status": "pending"},
        },
    )()
    app = app_with_repository(repository)

    response = TestClient(app).post(
        "/workspaces/workspace-1/policy-decisions",
        headers={"Authorization": "Bearer user-token"},
        json={"action": "connector.invoke", "summary": "Search an approved research source"},
    )

    assert response.status_code == 200
    assert response.json() == {"decision": "require_approval", "approval": {"id": "approval-1", "status": "pending"}}
    assert approvals == [("user-1", "workspace-1", "connector.invoke", "Search an approved research source")]


def test_workspace_admin_can_define_a_policy_rule():
    created = []
    repository = type(
        "Repository",
        (),
        {
            "can_manage_workspace": lambda *_: True,
                "create_policy": lambda _self, user_id, workspace_id, action, decision: created.append(
                (user_id, workspace_id, action, decision)
            )
            or {"id": "policy-1", "action": action, "decision": decision, "enabled": True},
        },
    )()
    app = app_with_repository(repository)

    response = TestClient(app).post(
        "/workspaces/workspace-1/policies",
        headers={"Authorization": "Bearer user-token"},
        json={"action": "connector.invoke", "decision": "require_approval"},
    )

    assert response.status_code == 201
    assert response.json()["decision"] == "require_approval"
    assert created == [("user-1", "workspace-1", "connector.invoke", "require_approval")]


def test_workspace_member_can_list_policy_rules():
    repository = type(
        "Repository",
        (),
        {
            "owns_workspace": lambda *_: True,
            "list_policies": lambda *_: [{"id": "policy-1", "action": "connector.invoke", "decision": "deny", "enabled": True}],
        },
    )()
    app = app_with_repository(repository)

    response = TestClient(app).get(
        "/workspaces/workspace-1/policies",
        headers={"Authorization": "Bearer user-token"},
    )

    assert response.status_code == 200
    assert response.json() == [{"id": "policy-1", "action": "connector.invoke", "decision": "deny", "enabled": True}]


def test_workspace_member_can_list_only_their_artifact_metadata():
    repository = type(
        "Repository",
        (),
        {
            "owns_workspace": lambda *_: True,
            "list_artifacts": lambda *_: [{"id": "artifact-1", "name": "brief.md", "status": "normalized"}],
        },
    )()
    response = TestClient(app_with_repository(repository)).get(
        "/workspaces/workspace-1/artifacts", headers={"Authorization": "Bearer user-token"}
    )
    assert response.status_code == 200
    assert response.json() == [{"id": "artifact-1", "name": "brief.md", "status": "normalized"}]


def test_artifacts_are_not_listed_from_an_unavailable_workspace():
    repository = type("Repository", (), {"owns_workspace": lambda *_: False})()
    response = TestClient(app_with_repository(repository)).get(
        "/workspaces/workspace-2/artifacts", headers={"Authorization": "Bearer user-token"}
    )
    assert response.status_code == 404


def test_workspace_admin_registers_an_adapter_disabled_by_default():
    created = []
    repository = type(
        "Repository",
        (),
        {
            "can_manage_workspace": lambda *_: True,
            "create_adapter": lambda _self, user_id, workspace_id, name, manifest: created.append((user_id, workspace_id, name, manifest)) or {"id": "adapter-1", "name": name, "enabled": False},
        },
    )()
    response = TestClient(app_with_repository(repository)).post(
        "/workspaces/workspace-1/adapters",
        headers={"Authorization": "Bearer user-token"},
        json={"name": "graphify", "manifest": {"mode": "ast"}},
    )
    assert response.status_code == 201
    assert response.json()["enabled"] is False
    assert created == [("user-1", "workspace-1", "graphify", {"mode": "ast"})]


def test_normalizing_an_artifact_requires_workspace_access():
    normalized = []
    repository = type("Repository", (), {"artifact": lambda *_: {"id": "artifact-1", "workspace_id": "workspace-1", "storage_key": "brief.md"}, "owns_workspace": lambda *_: True, "replace_artifact_chunks": lambda *_: None, "set_artifact_normalized": lambda _self, artifact_id: normalized.append(artifact_id)})()
    app = app_with_repository(repository)
    app.state.admin_supabase = type("Admin", (), {"storage": type("Storage", (), {"from_": lambda *_: type("Bucket", (), {"download": lambda *_: b"brief"})()})()})()
    response = TestClient(app).post(
        "/artifacts/artifact-1/normalize", headers={"Authorization": "Bearer user-token"}
    )
    assert response.status_code == 204
    assert normalized == ["artifact-1"]


def test_normalizing_an_office_artifact_uses_document_converter(monkeypatch):
    chunks = []
    repository = type("Repository", (), {"artifact": lambda *_: {"id": "artifact-1", "workspace_id": "workspace-1", "storage_key": "brief.docx", "name": "brief.docx"}, "owns_workspace": lambda *_: True, "replace_artifact_chunks": lambda _self, _artifact_id, items: chunks.extend(items), "set_artifact_normalized": lambda *_: None})()
    app = app_with_repository(repository)
    app.state.admin_supabase = type("Admin", (), {"storage": type("Storage", (), {"from_": lambda *_: type("Bucket", (), {"download": lambda *_: b"office bytes"})()})()})()
    monkeypatch.setattr(organizations_api, "convert_document", lambda content, name: "# Converted")

    response = TestClient(app).post("/artifacts/artifact-1/normalize", headers={"Authorization": "Bearer user-token"})

    assert response.status_code == 204
    assert chunks[0]["content"] == "# Converted"


def test_workspace_member_can_create_a_cited_research_report():
    created = []
    repository = type("Repository", (), {"owns_workspace": lambda *_: True, "create_research_report": lambda _self, user_id, workspace_id, title, content, citations: created.append((user_id, workspace_id, title, content, citations)) or {"id": "report-1", "title": title, "citations": citations}})()
    response = TestClient(app_with_repository(repository)).post(
        "/workspaces/workspace-1/research-reports", headers={"Authorization": "Bearer user-token"},
        json={"title": "Research", "content": "Finding", "citations": ["artifact-1"]},
    )
    assert response.status_code == 201
    assert response.json()["citations"] == ["artifact-1"]
    assert created == [("user-1", "workspace-1", "Research", "Finding", ["artifact-1"])]


def test_accepting_an_observation_creates_a_draft_skill_only():
    created = []
    repository = type("Repository", (), {"observation": lambda *_: {"workspace_id": "workspace-1", "status": "draft", "title": "Research helper", "manifest": {"tools": [], "data_access": []}}, "can_manage_workspace": lambda *_: True, "create_skill": lambda _self, user_id, workspace_id, name, version, manifest: created.append((user_id, workspace_id, name, version, manifest)) or {"id": "skill-1", "status": "draft"}, "accept_observation": lambda *_: None})()
    response = TestClient(app_with_repository(repository)).post(
        "/skill-observations/observation-1/accept", headers={"Authorization": "Bearer user-token"}
    )
    assert response.status_code == 201
    assert response.json()["status"] == "draft"
    assert created == [("user-1", "workspace-1", "Research helper", "1.0.0", {"tools": [], "data_access": []})]


def test_artifact_download_requires_workspace_access_before_signing():
    repository = type("Repository", (), {"artifact": lambda *_: {"workspace_id": "workspace-1", "storage_key": "org/workspace/artifact/brief.md"}, "owns_workspace": lambda *_: True})()
    app = app_with_repository(repository)
    app.state.admin_supabase = type("Admin", (), {"storage": type("Storage", (), {"from_": lambda *_: type("Bucket", (), {"create_signed_url": lambda *_: {"signedURL": "https://signed.example"}})()})()})()
    response = TestClient(app).get("/artifacts/artifact-1/download", headers={"Authorization": "Bearer user-token"})
    assert response.status_code == 200
    assert response.json() == {"url": "https://signed.example"}


def test_workspace_member_uploads_text_to_a_server_generated_private_key():
    created = []
    repository = type("Repository", (), {"owns_workspace": lambda *_: True, "workspace_organization": lambda *_: "org-1", "create_artifact": lambda _self, user_id, workspace_id, name, mime_type, storage_key, content_hash: created.append((user_id, workspace_id, name, mime_type, storage_key, content_hash)) or {"id": "artifact-1", "status": "uploaded"}})()
    app = app_with_repository(repository)
    bucket = type("Bucket", (), {"upload": lambda *_args, **_kwargs: None})()
    app.state.admin_supabase = type("Admin", (), {"storage": type("Storage", (), {"from_": lambda *_: bucket})()})()
    response = TestClient(app).post("/workspaces/workspace-1/artifacts?name=brief.md&mime_type=text/markdown", headers={"Authorization": "Bearer user-token"}, content=b"hello")
    assert response.status_code == 201
    assert created[0][:4] == ("user-1", "workspace-1", "brief.md", "text/markdown")
    assert created[0][4].startswith("org-1/workspace-1/") and created[0][4].endswith("/brief.md")


def test_workspace_admin_imports_catalog_skills_as_published(monkeypatch):
    imported = []
    repository = type("Repository", (), {"can_manage_workspace": lambda *_: True, "skill_exists": lambda *_: False, "create_imported_skill": lambda _self, user_id, workspace_id, package: imported.append((user_id, workspace_id, package)) or {"id": "skill-1", "status": "published"}})()
    monkeypatch.setattr(organizations_api, "catalog", lambda: ({"id": "hermes-process", "source": "hermes-agent", "name": "Hermes process", "version": "abc", "manifest": {"tools": [], "data_access": []}, "provenance": {"revision": "abc"}},))

    response = TestClient(app_with_repository(repository)).post("/workspaces/workspace-1/upstream-skills/import", headers={"Authorization": "Bearer user-token"})

    assert response.status_code == 201
    assert response.json() == {"imported": 1, "skipped": 0}
    assert imported[0][2]["source"] == "hermes-agent"


def test_organization_admin_can_create_a_custom_role():
    created = []
    repository = type(
        "Repository",
        (),
        {
            "can_manage_organization": lambda *_: True,
            "create_custom_role": lambda _self, user_id, organization_id, name, permissions: created.append(
                (user_id, organization_id, name, permissions)
            )
            or {"id": "role-1", "name": name, "permissions": permissions},
        },
    )()
    app = app_with_repository(repository)

    response = TestClient(app).post(
        "/organizations/org-1/custom-roles",
        headers={"Authorization": "Bearer user-token"},
        json={"name": "Research operator", "permissions": ["workspace.manage", "connector.invoke"]},
    )

    assert response.status_code == 201
    assert response.json()["name"] == "Research operator"
    assert created == [("user-1", "org-1", "Research operator", ["workspace.manage", "connector.invoke"])]


def test_organization_admin_can_assign_a_custom_role_to_a_member():
    assigned = []
    repository = type(
        "Repository",
        (),
        {
            "can_manage_organization": lambda *_: True,
            "owns_custom_role": lambda *_: True,
            "is_organization_member": lambda *_: True,
            "assign_custom_role": lambda _self, organization_id, user_id, role_id: assigned.append(
                (organization_id, user_id, role_id)
            ),
        },
    )()
    app = app_with_repository(repository)

    response = TestClient(app).put(
        "/organizations/org-1/members/user-2/custom-role",
        headers={"Authorization": "Bearer user-token"},
        json={"role_id": "role-1"},
    )

    assert response.status_code == 204
    assert assigned == [("org-1", "user-2", "role-1")]


def test_custom_role_cannot_be_assigned_outside_the_organization():
    repository = type(
        "Repository",
        (),
        {
            "can_manage_organization": lambda *_: True,
            "owns_custom_role": lambda *_: True,
            "is_organization_member": lambda *_: False,
        },
    )()
    app = app_with_repository(repository)

    response = TestClient(app).put(
        "/organizations/org-1/members/user-2/custom-role",
        headers={"Authorization": "Bearer user-token"},
        json={"role_id": "role-1"},
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Member not found"}


def test_workspace_admin_can_publish_a_skill_under_review():
    updates = []
    repository = type(
        "Repository",
        (),
        {
            "skill": lambda *_: {"workspace_id": "workspace-1", "status": "in_review"},
            "can_manage_workspace": lambda *_: True,
            "set_skill_status": lambda _self, skill_id, status: updates.append((skill_id, status)),
        },
    )()
    app = app_with_repository(repository)

    response = TestClient(app).post(
        "/skills/skill-1/status",
        headers={"Authorization": "Bearer user-token"},
        json={"status": "published"},
    )

    assert response.status_code == 204
    assert updates == [("skill-1", "published")]


def test_workspace_admin_registers_a_ci_connection():
    created = []
    repository = type(
        "Repository",
        (),
        {
            "can_manage_workspace": lambda *_: True,
            "create_ci_connection": lambda _self, user_id, workspace_id, provider, external_ref, manifest: created.append(
                (user_id, workspace_id, provider, external_ref, manifest)
            )
            or {"id": "ci-1", "provider": provider, "external_ref": external_ref, "enabled": False},
        },
    )()
    app = app_with_repository(repository)

    response = TestClient(app).post(
        "/workspaces/workspace-1/ci-connections",
        headers={"Authorization": "Bearer user-token"},
        json={"provider": "github_actions", "external_ref": "acme/widgets", "manifest": {}},
    )

    assert response.status_code == 201
    assert response.json()["enabled"] is False
    assert created == [("user-1", "workspace-1", "github_actions", "acme/widgets", {})]


def test_workspace_member_can_list_pipeline_runs():
    repository = type(
        "Repository",
        (),
        {
            "owns_workspace": lambda *_: True,
            "list_pipeline_runs": lambda _self, workspace_id: [{"id": "run-1", "status": "succeeded"}],
        },
    )()

    response = TestClient(app_with_repository(repository)).get(
        "/workspaces/workspace-1/pipeline-runs", headers={"Authorization": "Bearer user-token"}
    )

    assert response.status_code == 200
    assert response.json() == [{"id": "run-1", "status": "succeeded"}]


def test_ci_webhook_rejects_an_incorrectly_signed_payload():
    app = app_with_repository(type("Repository", (), {})())
    app.state.admin_supabase = object()

    response = TestClient(app).post(
        "/workspaces/workspace-1/ci-connections/ci-1/webhook",
        headers={"X-Hub-Signature-256": "sha256=deadbeef"},
        content=b'{"workflow_run": {}}',
    )

    assert response.status_code == 401


def test_workspace_admin_registers_an_infra_connection():
    created = []
    repository = type(
        "Repository",
        (),
        {
            "can_manage_workspace": lambda *_: True,
            "create_infra_connection": lambda _self, user_id, workspace_id, kind, name, manifest: created.append(
                (user_id, workspace_id, kind, name, manifest)
            )
            or {"id": "infra-1", "kind": kind, "name": name, "enabled": False},
        },
    )()
    app = app_with_repository(repository)

    response = TestClient(app).post(
        "/workspaces/workspace-1/infra-connections",
        headers={"Authorization": "Bearer user-token"},
        json={"kind": "docker_host", "name": "prod-host", "manifest": {"host": "tcp://10.0.0.5:2376"}},
    )

    assert response.status_code == 201
    assert response.json()["enabled"] is False
    assert created == [("user-1", "workspace-1", "docker_host", "prod-host", {"host": "tcp://10.0.0.5:2376"})]


def test_infra_resources_are_denied_by_policy_without_reaching_the_agent(monkeypatch):
    import app.api.organizations as organizations_api

    repository = type(
        "Repository",
        (),
        {
            "owns_workspace": lambda *_: True,
            "infra_connection": lambda *_: {"id": "infra-1", "workspace_id": "workspace-1", "kind": "docker_host", "name": "prod-host", "manifest": {}},
            "policy_decision": lambda *_: "deny",
        },
    )()
    app = app_with_repository(repository)
    monkeypatch.setattr(
        organizations_api,
        "settings",
        type("Settings", (), {"orbital_infra_agent_url": "http://infra-agent", "orbital_infra_agent_token": "token"})(),
    )

    response = TestClient(app).get(
        "/workspaces/workspace-1/infra/infra-1/container", headers={"Authorization": "Bearer user-token"}
    )

    assert response.status_code == 200
    assert response.json() == {"status": "denied", "reason": "Workspace policy denied this action."}


def test_infra_action_requires_workspace_admin_not_just_membership():
    repository = type(
        "Repository",
        (),
        {
            "can_manage_workspace": lambda *_: False,
            "infra_connection": lambda *_: {"id": "infra-1", "workspace_id": "workspace-1", "kind": "docker_host", "name": "prod-host", "manifest": {}},
        },
    )()
    app = app_with_repository(repository)

    response = TestClient(app).post(
        "/workspaces/workspace-1/infra/infra-1/container/web-1/actions",
        headers={"Authorization": "Bearer user-token"},
        json={"action": "restart"},
    )

    assert response.status_code == 404


def test_infra_action_requiring_approval_never_reaches_the_agent(monkeypatch):
    import app.api.organizations as organizations_api

    approvals = []
    action_runs = []
    repository = type(
        "Repository",
        (),
        {
            "can_manage_workspace": lambda *_: True,
            "infra_connection": lambda *_: {"id": "infra-1", "workspace_id": "workspace-1", "kind": "docker_host", "name": "prod-host", "manifest": {}},
            "policy_decision": lambda *_: "require_approval",
            "create_approval_request": lambda _self, user_id, workspace_id, action, summary: approvals.append((user_id, workspace_id, action, summary))
            or {"id": "approval-1", "action": action, "summary": summary},
            "create_infra_action_run": lambda _self, *args: action_runs.append(args) or {"id": "run-1", **dict(zip(
                ["requested_by", "workspace_id", "infra_connection_id", "action", "resource_type", "resource_ref", "status", "params", "approval_request_id"], args
            ))},
        },
    )()
    app = app_with_repository(repository)
    monkeypatch.setattr(
        organizations_api,
        "settings",
        type("Settings", (), {"orbital_infra_agent_url": "http://infra-agent", "orbital_infra_agent_token": "token"})(),
    )

    response = TestClient(app).post(
        "/workspaces/workspace-1/infra/infra-1/container/web-1/actions",
        headers={"Authorization": "Bearer user-token"},
        json={"action": "restart"},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "approval_required", "approval_id": "approval-1"}
    assert approvals == [("user-1", "workspace-1", "infra.container.restart", "Restart container web-1 on prod-host")]
    assert action_runs[0][6] == "queued"


def test_approving_an_infra_action_dispatches_it_through_the_infra_agent(monkeypatch):
    import app.api.organizations as organizations_api

    dispatched = []
    action_run = {
        "id": "run-1",
        "workspace_id": "workspace-1",
        "infra_connection_id": "infra-1",
        "action": "infra.container.restart",
        "resource_type": "container",
        "resource_ref": "web-1",
        "status": "queued",
        "params": {},
        "approval_request_id": "approval-1",
        "requested_by": "user-2",
    }
    repository = type(
        "Repository",
        (),
        {
            "approval_request": lambda *_: {"id": "approval-1", "workspace_id": "workspace-1", "status": "pending"},
            "can_manage_workspace": lambda *_: True,
            "decide_approval_request": lambda *_: [{"id": "approval-1"}],
            "infra_action_run_by_approval": lambda *_: action_run,
            "ci_trigger_run_by_approval": lambda *_: None,
            "infra_connection": lambda *_: {"id": "infra-1", "workspace_id": "workspace-1", "kind": "docker_host", "name": "prod-host", "manifest": {}},
            "update_infra_action_run": lambda _self, action_run_id, status, error=None: dispatched.append((action_run_id, status, error)),
        },
    )()
    app = app_with_repository(repository)
    monkeypatch.setattr(
        organizations_api,
        "settings",
        type("Settings", (), {"orbital_infra_agent_url": "http://infra-agent", "orbital_infra_agent_token": "token"})(),
    )

    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {"status": "ok"}

    async def fake_post(_self, url, json, headers):
        dispatched.append(("post", url, json))
        return FakeResponse()

    monkeypatch.setattr("httpx.AsyncClient.post", fake_post)

    response = TestClient(app).post(
        "/approval-requests/approval-1/decision",
        headers={"Authorization": "Bearer user-token"},
        json={"decision": "approved"},
    )

    assert response.status_code == 204
    assert ("post", "http://infra-agent/containers/action", {"kind": "docker_host", "manifest": {}, "resource_ref": "web-1", "action": "restart"}) in dispatched
    assert ("run-1", "succeeded", None) in dispatched


def test_denying_an_infra_action_cancels_the_action_run_without_dispatching():
    cancelled = []
    action_run = {
        "id": "run-1",
        "workspace_id": "workspace-1",
        "infra_connection_id": "infra-1",
        "action": "infra.container.delete",
        "resource_type": "container",
        "resource_ref": "web-1",
        "status": "queued",
        "params": {},
        "approval_request_id": "approval-1",
        "requested_by": "user-2",
    }
    repository = type(
        "Repository",
        (),
        {
            "approval_request": lambda *_: {"id": "approval-1", "workspace_id": "workspace-1", "status": "pending"},
            "can_manage_workspace": lambda *_: True,
            "decide_approval_request": lambda *_: [{"id": "approval-1"}],
            "infra_action_run_by_approval": lambda *_: action_run,
            "ci_trigger_run_by_approval": lambda *_: None,
            "update_infra_action_run": lambda _self, action_run_id, status, error=None: cancelled.append((action_run_id, status)),
        },
    )()
    app = app_with_repository(repository)

    response = TestClient(app).post(
        "/approval-requests/approval-1/decision",
        headers={"Authorization": "Bearer user-token"},
        json={"decision": "denied"},
    )

    assert response.status_code == 204
    assert cancelled == [("run-1", "cancelled")]


def test_registering_a_ci_credential_requires_workspace_admin():
    repository = type(
        "Repository",
        (),
        {
            "ci_connection": lambda *_: {"id": "ci-1", "workspace_id": "workspace-1"},
            "can_manage_workspace": lambda *_: False,
        },
    )()
    app = app_with_repository(repository)

    response = TestClient(app).post(
        "/workspaces/workspace-1/ci-connections/ci-1/credential",
        headers={"Authorization": "Bearer user-token"},
        json={"token": "ghp_example"},
    )

    assert response.status_code == 404


def test_registering_a_ci_credential_encrypts_it_via_the_admin_client():
    upserts = []

    class FakeTable:
        def table(self, name):
            self.name = name
            return self

        def upsert(self, payload, on_conflict):
            upserts.append((self.name, payload, on_conflict))
            return self

        def execute(self):
            return self

    repository = type(
        "Repository",
        (),
        {
            "ci_connection": lambda *_: {"id": "ci-1", "workspace_id": "workspace-1"},
            "can_manage_workspace": lambda *_: True,
        },
    )()
    app = app_with_repository(repository)
    app.state.admin_supabase = FakeTable()
    app.state.credential_cipher = type("Cipher", (), {"encrypt": lambda _self, secret: f"enc:{secret}"})()

    response = TestClient(app).post(
        "/workspaces/workspace-1/ci-connections/ci-1/credential",
        headers={"Authorization": "Bearer user-token"},
        json={"token": "ghp_example"},
    )

    assert response.status_code == 204
    assert upserts == [("ci_credentials", {"ci_connection_id": "ci-1", "encrypted_secret": "enc:ghp_example", "created_by": "user-1"}, "ci_connection_id")]


def test_triggering_a_ci_pipeline_requiring_approval_never_reaches_github(monkeypatch):
    import app.api.organizations as organizations_api

    approvals = []
    repository = type(
        "Repository",
        (),
        {
            "ci_connection": lambda *_: {"id": "ci-1", "workspace_id": "workspace-1", "external_ref": "acme/widgets"},
            "can_manage_workspace": lambda *_: True,
            "policy_decision": lambda *_: "require_approval",
            "create_approval_request": lambda _self, user_id, workspace_id, action, summary: approvals.append((user_id, workspace_id, action, summary))
            or {"id": "approval-1", "action": action, "summary": summary},
            "create_ci_trigger_run": lambda _self, *args, **kwargs: {"id": "run-1", "status": "queued"},
        },
    )()
    app = app_with_repository(repository)
    app.state.admin_supabase = None
    app.state.credential_cipher = None

    response = TestClient(app).post(
        "/workspaces/workspace-1/ci-connections/ci-1/trigger",
        headers={"Authorization": "Bearer user-token"},
        json={"workflow_ref": "ci.yml", "git_ref": "main"},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "approval_required", "approval_id": "approval-1"}
    assert approvals == [("user-1", "workspace-1", "pipeline.run.trigger", "Trigger ci.yml@main on acme/widgets")]


def test_approving_a_ci_trigger_dispatches_a_workflow_dispatch(monkeypatch):
    trigger_run = {
        "id": "run-1",
        "workspace_id": "workspace-1",
        "ci_connection_id": "ci-1",
        "workflow_ref": "ci.yml",
        "git_ref": "main",
        "status": "queued",
        "approval_request_id": "approval-1",
        "requested_by": "user-2",
    }
    updates = []

    class FakeAdmin:
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
            return [{"encrypted_secret": "enc:gh-token"}]

    repository = type(
        "Repository",
        (),
        {
            "approval_request": lambda *_: {"id": "approval-1", "workspace_id": "workspace-1", "status": "pending"},
            "can_manage_workspace": lambda *_: True,
            "decide_approval_request": lambda *_: [{"id": "approval-1"}],
            "infra_action_run_by_approval": lambda *_: None,
            "ci_trigger_run_by_approval": lambda *_: trigger_run,
            "ci_connection": lambda *_: {"id": "ci-1", "workspace_id": "workspace-1", "external_ref": "acme/widgets"},
            "update_ci_trigger_run": lambda _self, trigger_run_id, status, error=None: updates.append((trigger_run_id, status, error)),
        },
    )()
    app = app_with_repository(repository)
    app.state.admin_supabase = FakeAdmin()
    app.state.credential_cipher = type("Cipher", (), {"decrypt": lambda _self, value: value.removeprefix("enc:")})()

    class FakeResponse:
        def raise_for_status(self):
            pass

    async def fake_post(_self, url, json, headers):
        updates.append(("post", url, json, headers))
        return FakeResponse()

    monkeypatch.setattr("httpx.AsyncClient.post", fake_post)

    response = TestClient(app).post(
        "/approval-requests/approval-1/decision",
        headers={"Authorization": "Bearer user-token"},
        json={"decision": "approved"},
    )

    assert response.status_code == 204
    assert (
        "post",
        "https://api.github.com/repos/acme/widgets/actions/workflows/ci.yml/dispatches",
        {"ref": "main"},
        {"Authorization": "Bearer gh-token", "Accept": "application/vnd.github+json"},
    ) in updates
    assert ("run-1", "succeeded", None) in updates


def test_denying_a_ci_trigger_cancels_it_without_dispatching():
    trigger_run = {
        "id": "run-1",
        "workspace_id": "workspace-1",
        "ci_connection_id": "ci-1",
        "workflow_ref": "ci.yml",
        "git_ref": "main",
        "status": "queued",
        "approval_request_id": "approval-1",
        "requested_by": "user-2",
    }
    cancelled = []
    repository = type(
        "Repository",
        (),
        {
            "approval_request": lambda *_: {"id": "approval-1", "workspace_id": "workspace-1", "status": "pending"},
            "can_manage_workspace": lambda *_: True,
            "decide_approval_request": lambda *_: [{"id": "approval-1"}],
            "infra_action_run_by_approval": lambda *_: None,
            "ci_trigger_run_by_approval": lambda *_: trigger_run,
            "update_ci_trigger_run": lambda _self, trigger_run_id, status, error=None: cancelled.append((trigger_run_id, status)),
        },
    )()
    app = app_with_repository(repository)

    response = TestClient(app).post(
        "/approval-requests/approval-1/decision",
        headers={"Authorization": "Bearer user-token"},
        json={"decision": "denied"},
    )

    assert response.status_code == 204
    assert cancelled == [("run-1", "cancelled")]


def test_repository_tree_404s_for_a_connection_in_another_workspace():
    repository = type(
        "Repository",
        (),
        {
            "ci_connection": lambda *_: {"id": "ci-1", "workspace_id": "workspace-2", "external_ref": "acme/widgets"},
            "owns_workspace": lambda *_: True,
        },
    )()
    app = app_with_repository(repository)

    response = TestClient(app).get(
        "/workspaces/workspace-1/repositories/ci-1/tree",
        headers={"Authorization": "Bearer user-token"},
    )

    assert response.status_code == 404


def test_repository_tree_proxies_github_through_the_gated_gateway(monkeypatch):
    import app.api.organizations as organizations_api

    repository = type(
        "Repository",
        (),
        {
            "ci_connection": lambda *_: {"id": "ci-1", "workspace_id": "workspace-1", "external_ref": "acme/widgets"},
            "owns_workspace": lambda *_: True,
            "policy_decision": lambda *_: "allow",
        },
    )()
    app = app_with_repository(repository)
    app.state.admin_supabase = None
    app.state.credential_cipher = None

    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return {"repo": "info", "default_branch": "main"}

    async def fake_get(_self, url, params=None, headers=None):
        return FakeResponse()

    monkeypatch.setattr("httpx.AsyncClient.get", fake_get)

    response = TestClient(app).get(
        "/workspaces/workspace-1/repositories/ci-1/tree",
        headers={"Authorization": "Bearer user-token"},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "completed", "data": {"repo": "info", "default_branch": "main"}}


def test_github_authorize_url_requires_a_pending_github_connection():
    repository = type(
        "Repository",
        (),
        {
            "external_connection": lambda *_: {"id": "conn-1", "workspace_id": "workspace-1", "provider": "github", "status": "active"},
            "can_manage_workspace": lambda *_: True,
        },
    )()
    app = app_with_repository(repository)

    response = TestClient(app).get(
        "/workspaces/workspace-1/external-connections/conn-1/github/authorize",
        headers={"Authorization": "Bearer user-token"},
    )

    assert response.status_code == 409


def test_github_authorize_url_returns_a_github_url_when_configured(monkeypatch):
    import app.api.organizations as organizations_api

    repository = type(
        "Repository",
        (),
        {
            "external_connection": lambda *_: {"id": "conn-1", "workspace_id": "workspace-1", "provider": "github", "status": "pending_authorization"},
            "can_manage_workspace": lambda *_: True,
        },
    )()
    app = app_with_repository(repository)
    monkeypatch.setattr(
        organizations_api,
        "settings",
        type("Settings", (), {"github_oauth_client_id": "client-123", "github_oauth_redirect_uri": "https://orbital.example/auth/github/callback"})(),
    )

    response = TestClient(app).get(
        "/workspaces/workspace-1/external-connections/conn-1/github/authorize",
        headers={"Authorization": "Bearer user-token"},
    )

    assert response.status_code == 200
    assert response.json()["authorize_url"].startswith("https://github.com/login/oauth/authorize?")


def test_github_callback_rejects_an_invalid_state():
    app = create_app()
    app.state.admin_supabase = type("Admin", (), {"table": lambda *_: (_ for _ in ()).throw(AssertionError("should not query"))})()

    class Repository:
        def external_connection(self, _connection_id):
            return None

    monkeypatch_target = "app.api.organizations.SupabaseOrganizationRepository"
    import app.api.organizations as organizations_api
    original = organizations_api.SupabaseOrganizationRepository
    organizations_api.SupabaseOrganizationRepository = lambda _client: Repository()
    try:
        response = TestClient(app).get("/auth/github/callback", params={"code": "abc", "state": "bad-state"})
    finally:
        organizations_api.SupabaseOrganizationRepository = original

    assert response.status_code == 404


def test_github_callback_stores_the_encrypted_token_and_activates_the_connection(monkeypatch):
    import app.api.organizations as organizations_api

    upserts = []
    updates = []

    class FakeTable:
        def __init__(self, name):
            self.name = name

        def upsert(self, payload, on_conflict):
            upserts.append((self.name, payload, on_conflict))
            return self

        def update(self, payload):
            updates.append((self.name, payload))
            return self

        def eq(self, _col, _value):
            return self

        def execute(self):
            return self

    class FakeAdmin:
        def table(self, name):
            return FakeTable(name)

    class Repository:
        def external_connection(self, _connection_id):
            return {"id": "conn-1", "workspace_id": "workspace-1", "provider": "github", "status": "pending_authorization"}

    app = create_app()
    app.state.admin_supabase = FakeAdmin()
    app.state.credential_cipher = type("Cipher", (), {"encrypt": lambda _self, secret: f"enc:{secret}"})()
    monkeypatch.setattr(organizations_api, "SupabaseOrganizationRepository", lambda _client: Repository())

    async def fake_exchange_code(*args, **kwargs):
        return "gho_abc123"

    monkeypatch.setattr(organizations_api.github_oauth, "exchange_code", fake_exchange_code)

    response = TestClient(app).get("/auth/github/callback", params={"code": "abc", "state": "conn-1"})

    assert response.status_code == 200
    assert ("external_connection_credentials", {"external_connection_id": "conn-1", "encrypted_secret": "enc:gho_abc123"}, "external_connection_id") in upserts
    assert ("external_connections", {"status": "active"}) in updates


def test_github_connection_repos_is_gated_by_policy():
    repository = type(
        "Repository",
        (),
        {
            "external_connection": lambda *_: {"id": "conn-1", "workspace_id": "workspace-1", "provider": "github", "status": "active"},
            "owns_workspace": lambda *_: True,
            "policy_decision": lambda *_: "deny",
        },
    )()
    app = app_with_repository(repository)

    response = TestClient(app).get(
        "/workspaces/workspace-1/external-connections/conn-1/github/repos",
        headers={"Authorization": "Bearer user-token"},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "denied", "reason": "Workspace policy denied this action."}


def test_github_connection_repos_lists_repos_using_the_decrypted_token(monkeypatch):
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

    repository = type(
        "Repository",
        (),
        {
            "external_connection": lambda *_: {"id": "conn-1", "workspace_id": "workspace-1", "provider": "github", "status": "active"},
            "owns_workspace": lambda *_: True,
            "policy_decision": lambda *_: "allow",
        },
    )()
    app = app_with_repository(repository)
    app.state.admin_supabase = FakeAdminTable([{"encrypted_secret": "enc:gho_abc123"}])
    app.state.credential_cipher = type("Cipher", (), {"decrypt": lambda _self, value: value.removeprefix("enc:")})()

    calls = []

    class FakeResponse:
        def raise_for_status(self):
            pass

        def json(self):
            return [{"full_name": "acme/widgets"}]

    async def fake_get(_self, url, params=None, headers=None):
        calls.append((url, params, headers))
        return FakeResponse()

    monkeypatch.setattr("httpx.AsyncClient.get", fake_get)

    response = TestClient(app).get(
        "/workspaces/workspace-1/external-connections/conn-1/github/repos",
        headers={"Authorization": "Bearer user-token"},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "completed", "data": [{"full_name": "acme/widgets"}]}
    assert calls[0][2]["Authorization"] == "Bearer gho_abc123"


def test_creating_a_db_connection_rejects_an_unsafe_host():
    repository = type("Repository", (), {"can_manage_workspace": lambda *_: True})()
    app = app_with_repository(repository)

    response = TestClient(app).post(
        "/workspaces/workspace-1/db-connections",
        headers={"Authorization": "Bearer user-token"},
        json={"kind": "postgres", "name": "prod", "host": "127.0.0.1", "port": 5432, "database_name": "app", "username": "app_ro", "password": "s3cret"},
    )

    assert response.status_code == 422


def test_creating_a_db_connection_encrypts_the_password_via_the_admin_client():
    created = []
    upserts = []

    class FakeTable:
        def __init__(self, name):
            self.name = name

        def upsert(self, payload, on_conflict):
            upserts.append((self.name, payload, on_conflict))
            return self

        def execute(self):
            return self

    repository = type(
        "Repository",
        (),
        {
            "can_manage_workspace": lambda *_: True,
            "create_db_connection": lambda _self, user_id, workspace_id, kind, name, host, port, database_name, username, ssl: created.append(
                (user_id, workspace_id, kind, name, host, port, database_name, username, ssl)
            )
            or {"id": "db-1", "kind": kind, "name": name},
        },
    )()
    app = app_with_repository(repository)
    app.state.admin_supabase = type("Admin", (), {"table": lambda _self, name: FakeTable(name)})()
    app.state.credential_cipher = type("Cipher", (), {"encrypt": lambda _self, secret: f"enc:{secret}"})()

    response = TestClient(app).post(
        "/workspaces/workspace-1/db-connections",
        headers={"Authorization": "Bearer user-token"},
        json={"kind": "postgres", "name": "prod", "host": "8.8.8.8", "port": 5432, "database_name": "app", "username": "app_ro", "password": "s3cret", "ssl": True},
    )

    assert response.status_code == 201
    assert created == [("user-1", "workspace-1", "postgres", "prod", "8.8.8.8", 5432, "app", "app_ro", True)]
    assert ("db_connection_credentials", {"db_connection_id": "db-1", "encrypted_secret": "enc:s3cret"}, "db_connection_id") in upserts


def test_db_connection_schema_is_gated_by_policy():
    repository = type(
        "Repository",
        (),
        {
            "db_connection": lambda *_: {"id": "db-1", "workspace_id": "workspace-1", "kind": "postgres", "name": "prod", "host": "8.8.8.8", "port": 5432, "database_name": "app", "username": "app_ro", "ssl": True},
            "owns_workspace": lambda *_: True,
            "policy_decision": lambda *_: "deny",
        },
    )()
    app = app_with_repository(repository)

    response = TestClient(app).get(
        "/workspaces/workspace-1/db-connections/db-1/schema",
        headers={"Authorization": "Bearer user-token"},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "denied", "reason": "Workspace policy denied this action."}


def test_db_connection_schema_404s_for_a_connection_in_another_workspace():
    repository = type(
        "Repository",
        (),
        {
            "db_connection": lambda *_: {"id": "db-1", "workspace_id": "workspace-2", "kind": "postgres", "name": "prod"},
            "owns_workspace": lambda *_: True,
        },
    )()
    app = app_with_repository(repository)

    response = TestClient(app).get(
        "/workspaces/workspace-1/db-connections/db-1/schema",
        headers={"Authorization": "Bearer user-token"},
    )

    assert response.status_code == 404
