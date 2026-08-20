import pytest

from app.services.db_gateway import DbGateway, _rows_to_tables, _safe_host

CONNECTION = {"id": "db-1", "name": "prod-postgres", "kind": "postgres", "host": "8.8.8.8", "port": 5432, "database_name": "app", "username": "app_ro", "ssl": True}


def test_safe_host_rejects_loopback_and_link_local_addresses():
    assert _safe_host("localhost") is False
    assert _safe_host("127.0.0.1") is False
    assert _safe_host("0.0.0.0") is False
    assert _safe_host("::1") is False
    assert _safe_host("169.254.169.254") is False  # cloud metadata endpoint
    assert _safe_host("10.0.0.5") is False  # private range


def test_safe_host_allows_public_ip_literals_and_hostnames():
    assert _safe_host("8.8.8.8") is True
    assert _safe_host("db.example.com") is True


def test_rows_to_tables_groups_columns_and_attaches_foreign_keys():
    columns = [
        {"table_name": "orders", "column_name": "id", "data_type": "uuid", "is_nullable": False, "is_primary": True},
        {"table_name": "orders", "column_name": "customer_id", "data_type": "uuid", "is_nullable": False, "is_primary": False},
    ]
    foreign_keys = [{"table_name": "orders", "column_name": "customer_id", "referenced_table": "customers", "referenced_column": "id"}]

    tables = _rows_to_tables(columns, foreign_keys)

    assert tables == [
        {
            "name": "orders",
            "columns": [
                {"name": "id", "type": "uuid", "nullable": False, "isPrimary": True},
                {"name": "customer_id", "type": "uuid", "nullable": False, "isPrimary": False},
            ],
            "foreignKeys": [{"column": "customer_id", "referencedTable": "customers", "referencedColumn": "id"}],
        }
    ]


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


class FakeCipher:
    def decrypt(self, value):
        return value.removeprefix("encrypted:")


class Policies:
    def __init__(self, decision="require_approval"):
        self.decision = decision
        self.approvals = []
        self.audits = []

    def policy_decision(self, _workspace_id, _action):
        return self.decision

    def create_approval_request(self, user_id, workspace_id, action, summary):
        approval = {"id": "approval-1", "action": action, "summary": summary}
        self.approvals.append((user_id, workspace_id, action, summary))
        return approval

    def record_tool_event(self, user_id, workspace_id, action, details):
        self.audits.append((user_id, workspace_id, action, details))


@pytest.mark.asyncio
async def test_introspect_denied_by_policy():
    policies = Policies(decision="deny")
    gateway = DbGateway(policies, admin=None, cipher=None)

    result = await gateway.introspect("user-1", "workspace-1", CONNECTION)

    assert result == {"status": "denied", "reason": "Workspace policy denied this action."}
    assert policies.audits == [("user-1", "workspace-1", "db.schema.read", {"status": "denied"})]


@pytest.mark.asyncio
async def test_introspect_requires_approval_by_default():
    policies = Policies(decision="require_approval")
    gateway = DbGateway(policies, admin=None, cipher=None)

    result = await gateway.introspect("user-1", "workspace-1", CONNECTION)

    assert result == {"status": "approval_required", "approval_id": "approval-1"}
    assert policies.approvals == [("user-1", "workspace-1", "db.schema.read", "Read schema from prod-postgres (postgres)")]


@pytest.mark.asyncio
async def test_introspect_blocks_an_unsafe_host_even_when_policy_allows():
    policies = Policies(decision="allow")
    gateway = DbGateway(policies, admin=None, cipher=None)

    result = await gateway.introspect("user-1", "workspace-1", {**CONNECTION, "host": "127.0.0.1"})

    assert result == {"status": "denied", "reason": "This host is not a valid external database target."}
    assert policies.audits == [("user-1", "workspace-1", "db.schema.read", {"status": "blocked_unsafe_host"})]


@pytest.mark.asyncio
async def test_introspect_reports_unavailable_when_no_credential_is_registered():
    policies = Policies(decision="allow")
    gateway = DbGateway(policies, admin=FakeAdminTable([]), cipher=FakeCipher())

    result = await gateway.introspect("user-1", "workspace-1", CONNECTION)

    assert result == {"status": "unavailable", "reason": "No credential is registered for this connection."}


@pytest.mark.asyncio
async def test_introspect_reports_unavailable_for_an_unsupported_kind():
    policies = Policies(decision="allow")
    gateway = DbGateway(policies, admin=FakeAdminTable([{"encrypted_secret": "encrypted:pw"}]), cipher=FakeCipher())

    result = await gateway.introspect("user-1", "workspace-1", {**CONNECTION, "kind": "snowflake"})

    assert result == {"status": "unavailable", "reason": "snowflake introspection is not supported yet."}


@pytest.mark.asyncio
async def test_introspect_postgres_returns_completed_with_the_introspected_schema(monkeypatch):
    import asyncpg

    class FakeConn:
        async def fetch(self, query, *args):
            if query.strip().startswith("select c.table_name"):
                return [{"table_name": "orders", "column_name": "id", "data_type": "uuid", "is_nullable": "NO", "is_primary": True}]
            return [{"table_name": "orders", "column_name": "customer_id", "referenced_table": "customers", "referenced_column": "id"}]

        async def close(self):
            pass

    calls = {}

    async def fake_connect(**kwargs):
        calls.update(kwargs)
        return FakeConn()

    monkeypatch.setattr(asyncpg, "connect", fake_connect)

    policies = Policies(decision="allow")
    gateway = DbGateway(policies, admin=FakeAdminTable([{"encrypted_secret": "encrypted:s3cret"}]), cipher=FakeCipher())

    result = await gateway.introspect("user-1", "workspace-1", CONNECTION)

    assert result["status"] == "completed"
    assert result["data"]["tables"][0]["name"] == "orders"
    assert calls["password"] == "s3cret"
    assert calls["ssl"] == "require"
