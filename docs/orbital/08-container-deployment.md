# Orbital Container Deployment

Orbital runs as four containers: `web` (host port 8090), `gateway` (host port 3100 → container 3000), `api` (internal port 8000), and `orbital-runners` (internal port 8010). Supabase is intentionally external and configured through `server/.env`.

1. Copy `.env.container.example` to `.env` and fill the values. Copy the API variables to `server/.env`.
2. Build and run with a Compose provider:

```sh
podman compose --env-file .env up --build
```

3. Open `http://localhost:8090`.

If Podman has no Compose provider installed, build the services separately with `podman build -f <Dockerfile>`; install `podman-compose` to run the full multi-container stack.

`ORBITAL_RUNNER_TOKEN` must be the same in the API and runner containers. Do not expose port 8010 publicly.
