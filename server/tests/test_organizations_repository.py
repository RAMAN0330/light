from app.repositories.organizations import SupabaseOrganizationRepository


class FakeTable:
    def __init__(self, rows):
        self.rows = rows
        self.calls = []

    def table(self, name):
        self.calls.append(("table", name))
        return self

    def upsert(self, payload, on_conflict=None):
        self.calls.append(("upsert", payload, on_conflict))
        return self

    def execute(self):
        return self

    @property
    def data(self):
        return self.rows


def test_create_ci_connection_upserts_on_the_tables_unique_constraint():
    client = FakeTable([{"id": "ci-1", "provider": "github_actions", "external_ref": "acme/widgets", "enabled": True}])
    repository = SupabaseOrganizationRepository(client)

    result = repository.create_ci_connection("user-1", "workspace-1", "github_actions", "acme/widgets", {})

    assert result["id"] == "ci-1"
    upsert_call = next(call for call in client.calls if call[0] == "upsert")
    _, payload, on_conflict = upsert_call
    assert on_conflict == "workspace_id,provider,external_ref"
    assert payload["enabled"] is True
    assert payload["workspace_id"] == "workspace-1"
    assert payload["external_ref"] == "acme/widgets"
