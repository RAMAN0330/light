# Full-stack chatbot

React frontend, FastAPI backend, Supabase authentication/history, and OpenRouter streamed responses.

## Setup

Orbital's document-normalization adapter requires Python 3.10 or newer (the included Docker image uses Python 3.11). For local development:

```bash
cd server
python3.11 -m venv .venv311
.venv311/bin/python -m pip install -r requirements.txt
```

1. Create a Supabase project, then run [supabase/schema.sql](supabase/schema.sql) in its SQL Editor. Existing installations should also run [supabase/migrations/20260814_orbital_foundation.sql](supabase/migrations/20260814_orbital_foundation.sql) to add organization and workspace tenancy.
   For an existing project, apply each SQL file in `supabase/migrations/` instead; do not rerun the full schema.
2. Enable Email authentication in Supabase Authentication settings.
3. Copy `server/.env.example` to `server/.env`, then add your OpenRouter key and Supabase publishable key. In production, set `ORBITAL_CORS_ORIGINS` to the exact HTTPS browser origins.
4. Copy `client/.env.example` to `client/.env`, then add your Supabase URL and anonymous key.

## Run

Start the API:

```bash
cd server
.venv311/bin/uvicorn app.main:app --reload
```

Start the React app in another terminal:

```bash
cd client
npm run dev
```

Open the local Vite URL (usually `http://localhost:5173`), create an account, and chat.

For a self-hosted application deployment (using an external Supabase/GoTrue deployment), copy the API environment file, set the matching `VITE_*` browser-safe values in your shell, then run:

```bash
docker compose up --build
```

## Verify

```bash
cd server && .venv/bin/python -m pytest -v
cd client && npm test -- --run && npm run build
```

Keep `OPENROUTER_API_KEY`, `SUPABASE_SECRET_KEY`, and `ORBITAL_ENCRYPTION_KEY` private: they belong in `server/.env` or a production secret manager only. The Supabase publishable key is safe for both the client and server; user access is restricted by Row Level Security.

## Orbital Phase 1 configuration

Apply [`supabase/schema.sql`](supabase/schema.sql) to a new Supabase project. For an existing project, apply the current idempotent [`supabase/migrations/20260814_orbital_foundation.sql`](supabase/migrations/20260814_orbital_foundation.sql) in the Supabase SQL Editor. Set `ORBITAL_ENCRYPTION_KEY` to a Fernet key from your secret manager before registering provider credentials; provider secrets are encrypted server-side and are never returned by the API.

The Phase 1 release checklist is in [`docs/orbital/07-phase-1-release-runbook.md`](docs/orbital/07-phase-1-release-runbook.md). Configure OIDC/SAML and SCIM in the Supabase Auth/enterprise IdP tenant before enabling them for users; those provider-side changes require your administrator credentials.
