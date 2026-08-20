import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Database, FolderGit2, Play, Plus } from "lucide-react";

import { databaseApi, type DbConnection, type DbSchemaTable } from "../api/databases";
import { repositoryApi, type TreeEntry } from "../api/repositories";
import ERDiagramGraph from "../features/database/components/ERDiagramGraph";
import { parseDbSchema, dbSchemaToFlowSchema } from "../features/database/services/dbParser";
import { Input, Select } from "./ui/field";
import { SPRING_SNAPPY } from "../lib/motion";

type Source = "credentials" | "repo";

const SCHEMA_FILE_PATTERN = /\.(py|sql|prisma)$/i;
const MAX_SCHEMA_FILES = 60;

function gatedMessage(status: string, extra?: { reason?: string; error?: string }): string {
  if (status === "approval_required") return "This requires workspace approval — check the Approval inbox.";
  return extra?.reason || extra?.error || "Unavailable.";
}

export function DatabaseSchemaPanel({
  accessToken,
  workspaceId,
  connectionId,
  tree,
}: {
  accessToken: string;
  workspaceId: string;
  connectionId: string;
  tree: TreeEntry[];
}) {
  const [source, setSource] = useState<Source>("repo");
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [selectedDbId, setSelectedDbId] = useState("");
  const [tables, setTables] = useState<DbSchemaTable[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<DbConnection["kind"]>("postgres");
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("5432");
  const [databaseName, setDatabaseName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [ssl, setSsl] = useState(true);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    databaseApi.listDbConnections(accessToken, workspaceId).then((items) => {
      setConnections(items);
      setSelectedDbId((current) => current || items[0]?.id || "");
    }).catch(() => {});
  }, [accessToken, workspaceId]);

  async function scanRepoForSchema() {
    if (!connectionId) return;
    setLoading(true);
    setMessage("");
    try {
      const candidates = tree.filter((entry) => entry.type === "blob" && SCHEMA_FILE_PATTERN.test(entry.path)).slice(0, MAX_SCHEMA_FILES);
      const files = await Promise.all(
        candidates.map(async (entry) => {
          const result = await repositoryApi.fileContent(accessToken, workspaceId, connectionId, entry.path);
          return { path: entry.path, content: result.status === "completed" ? result.data : null };
        }),
      );
      const parsed = parseDbSchema(files);
      if (!parsed.tables.length) {
        setMessage("No recognizable schema files (Django/SQLAlchemy/Prisma models, .sql) found in this repository.");
        setTables([]);
        return;
      }
      setTables(dbSchemaToFlowSchema(parsed).tables);
    } catch {
      setMessage("Could not read the repository.");
    } finally {
      setLoading(false);
    }
  }

  async function createConnection(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim() || !host.trim() || !databaseName.trim() || !username.trim() || !password.trim()) return;
    const connection = await databaseApi.createDbConnection(accessToken, workspaceId, {
      kind, name: name.trim(), host: host.trim(), port: Number(port), database_name: databaseName.trim(), username: username.trim(), password, ssl,
    });
    setConnections((items) => [connection, ...items]);
    setSelectedDbId(connection.id);
    setShowForm(false);
    setPassword("");
  }

  async function loadSchema() {
    if (!selectedDbId) return;
    setLoading(true);
    setMessage("");
    try {
      const result = await databaseApi.schema(accessToken, workspaceId, selectedDbId);
      if (result.status === "completed") setTables(result.data.tables);
      else {
        setTables([]);
        setMessage(gatedMessage(result.status, result as any));
      }
    } catch {
      setMessage("Could not reach the database.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="db-panel">
      <div className="repo-tabs">
        {([
          { id: "repo" as const, label: "From this repo", icon: <FolderGit2 size={14} /> },
          { id: "credentials" as const, label: "Live connection", icon: <Database size={14} /> },
        ]).map((item) => {
          const active = source === item.id;
          return (
            <button type="button" key={item.id} className={active ? "repo-tab active" : "repo-tab"} onClick={() => setSource(item.id)}>
              {active && (
                <motion.span
                  layoutId="db-source-tab-active"
                  className="repo-tab-active-indicator"
                  transition={reduceMotion ? { duration: 0 } : SPRING_SNAPPY}
                />
              )}
              <span className="repo-tab-content">{item.icon} {item.label}</span>
            </button>
          );
        })}
      </div>

      {source === "repo" && (
        <div className="db-source-body">
          <button type="button" className="dialog-primary" onClick={() => void scanRepoForSchema()} disabled={loading}>
            <Play size={16} /> {loading ? "Scanning…" : "Scan repository for models"}
          </button>
        </div>
      )}

      {source === "credentials" && (
        <div className="db-source-body">
          {connections.length > 0 && (
            <div className="db-connection-row">
              <Select aria-label="Database connection" value={selectedDbId} onChange={(event) => setSelectedDbId(event.target.value)}>
                {connections.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.kind})</option>
                ))}
              </Select>
              <button type="button" className="dialog-primary" onClick={() => void loadSchema()} disabled={loading}>
                {loading ? "Reading…" : "Read schema"}
              </button>
            </div>
          )}
          <button type="button" className="infra-toggle-link" onClick={() => setShowForm((open) => !open)}>
            {showForm ? "Cancel" : "Register a database connection"}
          </button>
          {showForm && (
            <form onSubmit={createConnection} className="db-connect-form">
              <Select aria-label="Database kind" value={kind} onChange={(event) => setKind(event.target.value as DbConnection["kind"])}>
                <option value="postgres">PostgreSQL</option>
                <option value="mysql">MySQL</option>
                <option value="mongodb">MongoDB</option>
              </Select>
              <Input aria-label="Connection name" value={name} onChange={(event) => setName(event.target.value)} placeholder="prod-postgres" />
              <Input aria-label="Host" value={host} onChange={(event) => setHost(event.target.value)} placeholder="db.example.com" />
              <Input aria-label="Port" type="number" value={port} onChange={(event) => setPort(event.target.value)} />
              <Input aria-label="Database name" value={databaseName} onChange={(event) => setDatabaseName(event.target.value)} placeholder="app" />
              <Input aria-label="Username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="app_ro" />
              <Input aria-label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
              <label className="db-ssl-toggle">
                <input type="checkbox" checked={ssl} onChange={(event) => setSsl(event.target.checked)} /> Use SSL
              </label>
              <button className="dialog-primary" type="submit"><Plus size={16} /> Save connection</button>
            </form>
          )}
        </div>
      )}

      {message && <p className="project-empty">{message}</p>}

      <div className="db-diagram">
        {tables.length > 0 ? <ERDiagramGraph schema={{ tables }} isRealSchema /> : <p className="project-empty">No schema loaded yet.</p>}
      </div>
    </div>
  );
}
