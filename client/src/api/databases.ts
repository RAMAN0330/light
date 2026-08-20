export type DbConnection = { id: string; kind: "postgres" | "mysql" | "mongodb"; name: string; host: string; port: number; database_name: string; username: string; ssl: boolean; enabled: boolean };
export type DbSchemaTable = { name: string; columns: { name: string; type: string; nullable: boolean; isPrimary: boolean }[]; foreignKeys: { column: string; referencedTable: string; referencedColumn: string }[] };
export type DbSchemaResult =
  | { status: "completed"; data: { tables: DbSchemaTable[] } }
  | { status: "approval_required"; approval_id: string }
  | { status: "denied"; reason: string }
  | { status: "unavailable"; reason: string }
  | { status: "failed"; error: string };

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(token: string, path: string, options: RequestInit = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || "Request failed");
  return response;
}

export const databaseApi = {
  async listDbConnections(token: string, workspaceId: string): Promise<DbConnection[]> {
    return (await request(token, `/workspaces/${workspaceId}/db-connections`)).json();
  },
  async createDbConnection(
    token: string,
    workspaceId: string,
    body: { kind: DbConnection["kind"]; name: string; host: string; port: number; database_name: string; username: string; password: string; ssl: boolean },
  ): Promise<DbConnection> {
    return (await request(token, `/workspaces/${workspaceId}/db-connections`, { method: "POST", body: JSON.stringify(body) })).json();
  },
  async schema(token: string, workspaceId: string, connectionId: string): Promise<DbSchemaResult> {
    return (await request(token, `/workspaces/${workspaceId}/db-connections/${connectionId}/schema`)).json();
  },
};
