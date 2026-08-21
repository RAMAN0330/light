"""Run by a trusted scheduler on an interval, never by the API server.

Polls each enabled repo connection for new commits and runs the structural
analysis in app/services/commit_analysis.py on any commit not yet analyzed.
Mirrors app/workers/ci_sync.py's invocation shape exactly.
"""
import asyncio

from supabase import create_client

from app.core.config import settings
from app.repositories.organizations import SupabaseOrganizationRepository
from app.services.commit_analysis import sync_all_commit_analyses


def main():
    if not settings.orbital_commit_analysis_enabled:
        raise SystemExit("Set ORBITAL_COMMIT_ANALYSIS_ENABLED=true to poll commit analyses")
    if not settings.supabase_url or not settings.supabase_secret_key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SECRET_KEY are required")
    repository = SupabaseOrganizationRepository(
        create_client(settings.supabase_url, settings.supabase_secret_key)
    )
    print(asyncio.run(sync_all_commit_analyses(repository, settings.github_poll_token, settings.github_api_url)))


if __name__ == "__main__":
    main()
