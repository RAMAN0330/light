"""Policy-gated, audited schema introspection for live database connections.

This is a meaningfully higher-risk category than repo browsing or infra
reads: it stores real database credentials and has the backend connect out
to a customer-specified host. Two defenses, neither alone sufficient:

1. Governance: `db.schema.read` defaults to require_approval for every
   workspace (20260824_orbital_db_connections.sql) — every introspection
   attempt is policy-checked and audited before a single byte reaches the
   target database, same shape as every other gateway in this codebase.
2. Network: `_safe_host` rejects loopback/private/link-local IP literals
   before connecting — an SSRF backstop, not a substitute for #1. Like the
   existing `safe_connector_endpoint` check this mirrors, it does not resolve
   hostnames, so a DNS name pointing at an internal address is not caught
   here; that gap is inherited from the existing pattern, not introduced by
   this file.

The password is stored encrypted (db_connection_credentials, RLS with no
client-facing select policy) and only ever decrypted here, at the moment of
connecting — mirroring ci_credentials/external_connection_credentials exactly.
"""
from __future__ import annotations

import ipaddress


class DbGatewayError(ValueError):
    pass


def _safe_host(host: str) -> bool:
    if host.lower() in {"localhost", "127.0.0.1", "::1", "0.0.0.0"}:
        return False
    try:
        return ipaddress.ip_address(host).is_global
    except ValueError:
        return True  # a hostname, not an IP literal — not resolved/validated further


def _rows_to_tables(columns: list[dict], foreign_keys: list[dict]) -> list[dict]:
    tables: dict[str, dict] = {}
    for row in columns:
        table = tables.setdefault(row["table_name"], {"name": row["table_name"], "columns": [], "foreignKeys": []})
        table["columns"].append(
            {
                "name": row["column_name"],
                "type": row["data_type"],
                "nullable": row["is_nullable"] in (True, "YES", "yes"),
                "isPrimary": bool(row.get("is_primary")),
            }
        )
    for row in foreign_keys:
        table = tables.get(row["table_name"])
        if table is not None:
            table["foreignKeys"].append(
                {"column": row["column_name"], "referencedTable": row["referenced_table"], "referencedColumn": row["referenced_column"]}
            )
    return list(tables.values())


class DbGateway:
    def __init__(self, policies, admin, cipher) -> None:
        self.policies = policies
        self.admin = admin
        self.cipher = cipher

    def _audit(self, user_id: str, workspace_id: str, action: str, status: str) -> None:
        if hasattr(self.policies, "record_tool_event"):
            self.policies.record_tool_event(user_id, workspace_id, action, {"status": status})

    def _password_for(self, db_connection_id: str) -> str | None:
        if not self.admin or not self.cipher:
            return None
        rows = (
            self.admin.table("db_connection_credentials")
            .select("encrypted_secret")
            .eq("db_connection_id", db_connection_id)
            .limit(1)
            .execute()
            .data
        )
        if not rows:
            return None
        return self.cipher.decrypt(rows[0]["encrypted_secret"])

    async def introspect(self, user_id: str, workspace_id: str, connection: dict) -> dict:
        action = "db.schema.read"
        decision = self.policies.policy_decision(workspace_id, action)
        if decision == "deny":
            self._audit(user_id, workspace_id, action, "denied")
            return {"status": "denied", "reason": "Workspace policy denied this action."}
        if decision == "require_approval":
            approval = self.policies.create_approval_request(user_id, workspace_id, action, f"Read schema from {connection['name']} ({connection['kind']})")
            self._audit(user_id, workspace_id, action, "approval_required")
            return {"status": "approval_required", "approval_id": approval["id"]}
        if not _safe_host(connection["host"]):
            self._audit(user_id, workspace_id, action, "blocked_unsafe_host")
            return {"status": "denied", "reason": "This host is not a valid external database target."}
        password = self._password_for(connection["id"])
        if password is None:
            self._audit(user_id, workspace_id, action, "unavailable")
            return {"status": "unavailable", "reason": "No credential is registered for this connection."}
        try:
            if connection["kind"] == "postgres":
                tables = await self._introspect_postgres(connection, password)
            elif connection["kind"] == "mysql":
                tables = await self._introspect_mysql(connection, password)
            elif connection["kind"] == "mongodb":
                tables = await self._introspect_mongodb(connection, password)
            else:
                return {"status": "unavailable", "reason": f"{connection['kind']} introspection is not supported yet."}
        except Exception as error:  # noqa: BLE001 - surfaced to the caller, never crashes the gateway
            self._audit(user_id, workspace_id, action, "failed")
            return {"status": "failed", "error": str(error)}
        self._audit(user_id, workspace_id, action, "completed")
        return {"status": "completed", "data": {"tables": tables}}

    async def _introspect_postgres(self, connection: dict, password: str) -> list[dict]:
        import asyncpg

        conn = await asyncpg.connect(
            host=connection["host"], port=connection["port"], user=connection["username"],
            password=password, database=connection["database_name"],
            ssl="require" if connection.get("ssl") else None, timeout=10,
        )
        try:
            columns = await conn.fetch(
                """
                select c.table_name, c.column_name, c.data_type, c.is_nullable,
                  exists (
                    select 1 from information_schema.table_constraints tc
                    join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name
                    where tc.constraint_type = 'PRIMARY KEY' and tc.table_name = c.table_name and kcu.column_name = c.column_name
                  ) as is_primary
                from information_schema.columns c
                where c.table_schema = 'public'
                order by c.table_name, c.ordinal_position
                """
            )
            foreign_keys = await conn.fetch(
                """
                select tc.table_name, kcu.column_name, ccu.table_name as referenced_table, ccu.column_name as referenced_column
                from information_schema.table_constraints tc
                join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name
                join information_schema.constraint_column_usage ccu on tc.constraint_name = ccu.constraint_name
                where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
                """
            )
        finally:
            await conn.close()
        return _rows_to_tables([dict(row) for row in columns], [dict(row) for row in foreign_keys])

    async def _introspect_mysql(self, connection: dict, password: str) -> list[dict]:
        import aiomysql

        conn = await aiomysql.connect(
            host=connection["host"], port=connection["port"], user=connection["username"],
            password=password, db=connection["database_name"], connect_timeout=10,
        )
        try:
            async with conn.cursor(aiomysql.DictCursor) as cursor:
                await cursor.execute(
                    """
                    select table_name, column_name, data_type,
                      is_nullable, column_key = 'PRI' as is_primary
                    from information_schema.columns
                    where table_schema = %s
                    order by table_name, ordinal_position
                    """,
                    (connection["database_name"],),
                )
                columns = await cursor.fetchall()
                await cursor.execute(
                    """
                    select table_name, column_name, referenced_table_name as referenced_table, referenced_column_name as referenced_column
                    from information_schema.key_column_usage
                    where table_schema = %s and referenced_table_name is not null
                    """,
                    (connection["database_name"],),
                )
                foreign_keys = await cursor.fetchall()
        finally:
            conn.close()
        normalized_columns = [{**row, "is_nullable": row["is_nullable"] == "YES"} for row in columns]
        return _rows_to_tables(normalized_columns, foreign_keys)

    async def _introspect_mongodb(self, connection: dict, password: str, sample_size: int = 5) -> list[dict]:
        from motor.motor_asyncio import AsyncIOMotorClient

        scheme = "mongodb"
        uri = f"{scheme}://{connection['username']}:{password}@{connection['host']}:{connection['port']}/{connection['database_name']}"
        client = AsyncIOMotorClient(uri, serverSelectionTimeoutMS=10000)
        try:
            db = client[connection["database_name"]]
            collection_names = await db.list_collection_names()
            tables = []
            for name in collection_names:
                fields: dict[str, str] = {}
                async for doc in db[name].find().limit(sample_size):
                    for key, value in doc.items():
                        fields.setdefault(key, type(value).__name__)
                tables.append(
                    {
                        "name": name,
                        "columns": [{"name": key, "type": value_type, "nullable": True, "isPrimary": key == "_id"} for key, value_type in fields.items()],
                        "foreignKeys": [],
                    }
                )
            return tables
        finally:
            client.close()
