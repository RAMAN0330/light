"""Run by a trusted scheduler on an interval, never by the API server.

Poll-based fallback for workspaces whose CI provider webhook isn't reachable.
Mirrors app/workers/schedules.py's invocation shape exactly.
"""
import asyncio

from supabase import create_client

from app.core.config import settings
from app.repositories.organizations import SupabaseOrganizationRepository
from app.services.ci_ingestion import sync_all_ci_connections


def main():
    if not settings.orbital_ci_sync_enabled:
        raise SystemExit("Set ORBITAL_CI_SYNC_ENABLED=true to poll CI connections")
    if not settings.supabase_url or not settings.supabase_secret_key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SECRET_KEY are required")
    repository = SupabaseOrganizationRepository(
        create_client(settings.supabase_url, settings.supabase_secret_key)
    )
    print(asyncio.run(sync_all_ci_connections(repository, settings.github_poll_token, settings.github_api_url)))


if __name__ == "__main__":
    main()
