import express from 'express';
import cors from 'cors';
import { Client } from 'pg';
import mysql from 'mysql2/promise';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { createClient } from 'redis';
import passport from 'passport';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { env, validateEnvironment } from './config/env';
import type { SchemaColumn, SchemaForeignKey as SchemaFK, SchemaTable } from './types/schema';
import { createJsonProxy } from './middleware/asyncProxy';
import { fetchRepositoryTree, fetchUserRepositories } from './services/githubService';

validateEnvironment();

const redisClient = env.redisUrl ? createClient({ url: env.redisUrl }) : null;
redisClient?.on('error', error => console.error('Redis session error:', error));

const app = express();
app.set('trust proxy', 1);
app.use(cors({
  origin: env.clientOrigin,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

app.use(session({
  store: redisClient ? new RedisStore({ client: redisClient, prefix: 'codeflow:sess:' }) : undefined,
  secret: env.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.clientOrigin.startsWith('https://'),
    maxAge: 30 * 24 * 60 * 60 * 1000,
  },
}));

app.use(passport.initialize());
app.use(passport.session());

const githubAuthEnabled = Boolean(env.githubClientId && env.githubClientSecret);

class AccountSelectingGitHubStrategy extends GitHubStrategy {
  authorizationParams(options: { prompt?: string }) {
    return options.prompt ? { prompt: options.prompt } : {};
  }
}

if (githubAuthEnabled) {
  passport.use(new AccountSelectingGitHubStrategy(
    {
      clientID: env.githubClientId,
      clientSecret: env.githubClientSecret,
      callbackURL: env.githubCallbackUrl,
      scope: ['user', 'repo'],
    },
    (_accessToken: string, _refreshToken: string, profile: any, done: Function) => {
      done(null, {
        login: profile.username,
        avatar_url: profile.photos?.[0]?.value ?? '',
        token: _accessToken,
      });
    }
  ));
}

passport.serializeUser((user: any, done) => done(null, user));
passport.deserializeUser((user: any, done) => done(null, user));

app.get('/health/live', (_req, res) => res.json({ status: 'ok' }));

// --- PostgreSQL ---
app.post('/api/db/connect/postgres', async (req, res) => {
  const { host, port, database, user, password } = req.body;
  const client = new Client({ host, port: parseInt(port, 10) || 5432, database, user, password, connectionTimeoutMillis: 8000 });
  try {
    await client.connect();

    const tableResult = await client.query<{table_name:string}>(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name`);

    const tables: SchemaTable[] = await Promise.all(tableResult.rows.map(async ({ table_name }) => {
      const [colRes, pkRes, fkRes] = await Promise.all([
        client.query<{column_name:string; data_type:string; is_nullable:string}>(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema='public' AND table_name=$1
          ORDER BY ordinal_position`, [table_name]),
        client.query<{column_name:string}>(`
          SELECT kcu.column_name FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
          WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema='public' AND tc.table_name=$1`, [table_name]),
        client.query<{column_name:string; foreign_table:string; foreign_column:string}>(`
          SELECT kcu.column_name, ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
          WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema='public' AND tc.table_name=$1`, [table_name]),
      ]);
      const pks = new Set(pkRes.rows.map(r => r.column_name));
      return {
        name: table_name,
        columns: colRes.rows.map(r => ({ name: r.column_name, type: r.data_type, nullable: r.is_nullable === 'YES', isPrimary: pks.has(r.column_name) })),
        foreignKeys: fkRes.rows.map(r => ({ column: r.column_name, referencedTable: r.foreign_table, referencedColumn: r.foreign_column })),
      };
    }));

    await client.end();
    res.json({ success: true, schema: { tables } });
  } catch (error: any) {
    try { await client.end(); } catch {}
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- MySQL ---
app.post('/api/db/connect/mysql', async (req, res) => {
  const { host, port, database, user, password } = req.body;
  let conn: Awaited<ReturnType<typeof mysql.createConnection>> | undefined;
  try {
    conn = await mysql.createConnection({ host, port: parseInt(port, 10) || 3306, database, user, password, connectTimeout: 8000 });

    const [tableRows]: any = await conn.execute(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME`,
      [database]);

    const tables: SchemaTable[] = await Promise.all((tableRows as any[]).map(async (row: any) => {
      const tbl = row.TABLE_NAME;
      const [colRows]: any = await conn!.execute(
        `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=? AND TABLE_NAME=? ORDER BY ORDINAL_POSITION`,
        [database, tbl]);
      const [fkRows]: any = await conn!.execute(
        `SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=? AND TABLE_NAME=? AND REFERENCED_TABLE_NAME IS NOT NULL`,
        [database, tbl]);
      return {
        name: tbl,
        columns: (colRows as any[]).map((r: any) => ({ name: r.COLUMN_NAME, type: r.COLUMN_TYPE, nullable: r.IS_NULLABLE === 'YES', isPrimary: r.COLUMN_KEY === 'PRI' })),
        foreignKeys: (fkRows as any[]).map((r: any) => ({ column: r.COLUMN_NAME, referencedTable: r.REFERENCED_TABLE_NAME, referencedColumn: r.REFERENCED_COLUMN_NAME })),
      };
    }));

    await conn.end();
    res.json({ success: true, schema: { tables } });
  } catch (error: any) {
    try { if (conn) await conn.end(); } catch {}
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- SQL Dump Parser (client uploads .sql file text) ---
function splitSqlDefinitions(body: string): string[] {
  const definitions: string[] = [];
  let start = 0;
  let depth = 0;
  for (let index = 0; index < body.length; index += 1) {
    if (body[index] === '(') depth += 1;
    else if (body[index] === ')') depth = Math.max(0, depth - 1);
    else if (body[index] === ',' && depth === 0) {
      definitions.push(body.slice(start, index).trim());
      start = index + 1;
    }
  }
  definitions.push(body.slice(start).trim());
  return definitions.filter(Boolean);
}

app.post('/api/db/parse-sql', (req, res) => {
  const { sql } = req.body as { sql: string };
  if (!sql) return res.status(400).json({ success: false, error: 'No SQL provided' });
  try {
    const tables: SchemaTable[] = [];
    // Match CREATE TABLE blocks
    const createRe = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?\s*\(([^;]+)\)/gim;
    let m: RegExpExecArray | null;
    while ((m = createRe.exec(sql)) !== null) {
      const tableName = m[1];
      const body = m[2];
      const columns: SchemaColumn[] = [];
      const foreignKeys: SchemaFK[] = [];
      const pkCols = new Set<string>();
      // PRIMARY KEY inline or constraint
      const pkMatch = body.match(/PRIMARY\s+KEY\s*\(([^)]+)\)/i);
      if (pkMatch) pkMatch[1].split(',').forEach(c => pkCols.add(c.trim().replace(/[`"']/g, '')));
      // Foreign keys
      const fkRe = /FOREIGN\s+KEY\s*\([`"']?(\w+)[`"']?\)\s+REFERENCES\s+[`"']?(\w+)[`"']?\s*\([`"']?(\w+)[`"']?\)/gi;
      let fkM: RegExpExecArray | null;
      while ((fkM = fkRe.exec(body)) !== null) {
        foreignKeys.push({ column: fkM[1], referencedTable: fkM[2], referencedColumn: fkM[3] });
      }
      // Columns (skip constraint lines)
      const lines = splitSqlDefinitions(body);
      for (const line of lines) {
        const trimmed = line.trim().replace(/,$/, '');
        if (!trimmed || /^(PRIMARY|UNIQUE|INDEX|KEY|CONSTRAINT|FOREIGN)/i.test(trimmed)) continue;
        const colMatch = trimmed.match(/^[`"']?(\w+)[`"']?\s+(\S+)/);
        if (!colMatch) continue;
        const colName = colMatch[1];
        const colType = colMatch[2].replace(/[`"']/g, '');
        columns.push({ name: colName, type: colType, nullable: !/NOT\s+NULL/i.test(trimmed), isPrimary: pkCols.has(colName) || /PRIMARY\s+KEY/i.test(trimmed) });
      }
      if (columns.length > 0) tables.push({ name: tableName, columns, foreignKeys });
    }
    res.json({ success: true, schema: { tables } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- GitHub proxy ---
app.post('/api/github/repo', async (req, res) => {
  const { owner, repo, token } = req.body;
  try {
    const safeToken = token && /^[A-Za-z0-9_\-.]+$/.test(String(token)) ? String(token) : undefined;
    const data = await fetchRepositoryTree(owner, repo, safeToken) as { tree: unknown };
    res.json({ success: true, tree: data.tree });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Optional text-only enrichment for the deterministic client architecture graph.
app.post('/api/architecture/enrich', async (req, res) => {
  if (!env.openaiApiKey) return res.status(503).json({ error: 'AI explanation is not configured. The validated architecture remains available.' });
  const graph = req.body?.graph;
  if (!graph || graph.version !== 1 || !Array.isArray(graph.groups) || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) {
    return res.status(400).json({ error: 'A valid architecture graph is required.' });
  }
  if (graph.groups.length > 10 || graph.nodes.length > 60 || graph.edges.length > 120 || JSON.stringify(graph).length > 120_000) {
    return res.status(413).json({ error: 'Architecture graph exceeds enrichment limits.' });
  }
  const groups = graph.groups.map((group: any) => ({ id: String(group.id).slice(0, 80), label: String(group.label || '').slice(0, 120), description: String(group.description || '').slice(0, 400) }));
  const nodes = graph.nodes.map((node: any) => ({ id: String(node.id).slice(0, 80), groupId: String(node.groupId).slice(0, 80), label: String(node.label || '').slice(0, 120), description: String(node.description || '').slice(0, 400), paths: Array.isArray(node.paths) ? node.paths.slice(0, 30).map((path: unknown) => String(path).slice(0, 300)) : [] }));
  const edges = graph.edges.map((edge: any) => ({ source: String(edge.source).slice(0, 80), target: String(edge.target).slice(0, 80), label: String(edge.label || '').slice(0, 80) }));
  const groupIds = new Set(groups.map((group: any) => group.id));
  const nodeIds = new Set(nodes.map((node: any) => node.id));
  if (groups.some((group: any) => !group.id) || nodes.some((node: any) => !node.id || !groupIds.has(node.groupId)) || edges.some((edge: any) => !nodeIds.has(edge.source) || !nodeIds.has(edge.target))) {
    return res.status(400).json({ error: 'Architecture graph contains invalid topology.' });
  }

  const schema = {
    type: 'object', additionalProperties: false, required: ['summary', 'groups', 'nodes'],
    properties: {
      summary: { type: 'string', maxLength: 600 },
      groups: { type: 'array', maxItems: 10, items: { type: 'object', additionalProperties: false, required: ['id', 'label', 'description'], properties: { id: { type: 'string' }, label: { type: 'string' }, description: { type: 'string' } } } },
      nodes: { type: 'array', maxItems: 60, items: { type: 'object', additionalProperties: false, required: ['id', 'label', 'description'], properties: { id: { type: 'string' }, label: { type: 'string' }, description: { type: 'string' } } } },
    },
  };
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.openaiApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.openaiModel,
        input: [
          { role: 'system', content: [{ type: 'input_text', text: 'Explain this repository architecture concisely. Preserve every supplied ID exactly. Return text updates only; do not invent components, paths, connections, or IDs.' }] },
          { role: 'user', content: [{ type: 'input_text', text: JSON.stringify({ groups, nodes, edges }) }] },
        ],
        text: { format: { type: 'json_schema', name: 'architecture_enrichment', strict: true, schema } },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const result: any = await response.json();
    if (!response.ok) return res.status(502).json({ error: result?.error?.message || 'Explanation provider rejected the request.' });
    const outputText = result.output_text || result.output?.flatMap((item: any) => item.content || []).find((item: any) => item.type === 'output_text')?.text;
    if (!outputText) return res.status(502).json({ error: 'Explanation provider returned no structured output.' });
    const enrichment = JSON.parse(outputText);
    const safeGroups = Array.isArray(enrichment.groups) ? enrichment.groups.filter((item: any) => groupIds.has(item.id)).map((item: any) => ({ id: item.id, label: String(item.label || '').slice(0, 120), description: String(item.description || '').slice(0, 400) })) : [];
    const safeNodes = Array.isArray(enrichment.nodes) ? enrichment.nodes.filter((item: any) => nodeIds.has(item.id)).map((item: any) => ({ id: item.id, label: String(item.label || '').slice(0, 120), description: String(item.description || '').slice(0, 400) })) : [];
    return res.json({ summary: String(enrichment.summary || '').slice(0, 600), groups: safeGroups, nodes: safeNodes });
  } catch (error: any) {
    return res.status(502).json({ error: error?.name === 'TimeoutError' ? 'Explanation request timed out.' : 'Unable to generate the architecture explanation.' });
  }
});

// Auth routes
app.get('/auth/config', (_req, res) => res.json({ github: githubAuthEnabled }));

app.get('/auth/github', (req, res, next) => {
  if (!githubAuthEnabled) {
    return res.status(503).json({ error: 'GitHub OAuth is not configured. Public repositories and local folders remain available.' });
  }
  passport.authenticate('github', { prompt: 'select_account' } as any)(req, res, next);
});

app.get('/auth/github/callback', (req, res, next) => {
  if (!githubAuthEnabled) return res.redirect(`${env.clientOrigin}/?auth=unavailable`);
  passport.authenticate('github', { failureRedirect: `${env.clientOrigin}/login?auth=failed` })(req, res, next);
}, (_req: any, res: any) => {
  res.redirect(`${env.clientOrigin}/select-repo`);
});

app.get('/auth/me', (req: any, res: any) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  res.json(req.user);
});

function endAuthenticatedSession(req: any, res: any, redirect: boolean) {
  req.logout((logoutError: unknown) => {
    if (logoutError) return res.status(500).json({ error: 'Unable to sign out' });
    req.session.destroy((sessionError: unknown) => {
      if (sessionError) return res.status(500).json({ error: 'Unable to clear session' });
      res.clearCookie('connect.sid', { path: '/' });
      res.clearCookie('connect.sid', { path: '/', secure: false });
      if (redirect) return res.redirect(env.clientOrigin);
      return res.status(204).end();
    });
  });
}

app.post('/auth/logout', (req: any, res: any) => endAuthenticatedSession(req, res, false));
app.get('/auth/logout', (req: any, res: any) => endAuthenticatedSession(req, res, true));

// Fetch authenticated user's repos
app.get('/api/github/repos', async (req: any, res: any) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const repos = await fetchUserRepositories(req.user.token);
    res.json({ repos });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Proxy → FastAPI on port 8000
const proxyToFastAPI = createJsonProxy(env.fastApiUrl);
app.all('/api/analyze', proxyToFastAPI);
app.all('/api/tasks/:taskId', proxyToFastAPI);

async function start(): Promise<void> {
  if (redisClient && !redisClient.isOpen) await redisClient.connect();
  const server = app.listen(env.port, () => console.log(`Server running on http://localhost:${env.port}`));
  const shutdown = () => server.close(async () => { if (redisClient?.isOpen) await redisClient.quit(); process.exit(0); });
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

start().catch(error => { console.error('Server startup failed:', error); process.exit(1); });
