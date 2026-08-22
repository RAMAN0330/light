# codegraph

CodeGraph's own backend stack, ported as-is from the standalone CodeGraph project
(`~/Desktop/CodeGraph`) and run here as separate services alongside Orbital's
backend in `../server`.

- `server/app` — FastAPI service (`main.py`) + Celery worker (`worker.py`,
  `tasks.py`) that clones a repo and runs `graphify`/AST introspection.
- `server/src` — Node/Express gateway: GitHub OAuth, DB introspection proxying,
  session storage in Redis.
- `server-go` — Go gateway migration target for `server/src`, proxying to the
  FastAPI service and the Node legacy API.

## Running

```
cd codegraph
CODEGRAPH_SESSION_SECRET=... \
CODEGRAPH_GITHUB_CLIENT_ID=... \
CODEGRAPH_GITHUB_CLIENT_SECRET=... \
docker compose up --build
```

This starts its own Redis instance (`codegraph-redis`) and exposes the Go
gateway on `localhost:5100`. It does not share ports, containers, or Redis
with Orbital's `../docker-compose.yml`.

Set real secrets via `CODEGRAPH_GITHUB_CLIENT_ID`, `CODEGRAPH_GITHUB_CLIENT_SECRET`,
`CODEGRAPH_GITHUB_CALLBACK_URL`, and `CODEGRAPH_SESSION_SECRET` — do not commit
a `.env` with real values here; only `server/.env.example` is tracked.
