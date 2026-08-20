"""Run by a trusted scheduler once per minute, never by the API server."""
from datetime import datetime, timezone

from supabase import create_client

from app.core.config import settings
from app.repositories.organizations import SupabaseOrganizationRepository
from app.services.schedule_worker import process_due_schedules


def main():
    if not settings.orbital_schedule_worker_enabled:
        raise SystemExit("Set ORBITAL_SCHEDULE_WORKER_ENABLED=true to process schedules")
    if not settings.supabase_url or not settings.supabase_secret_key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SECRET_KEY are required")
    repository = SupabaseOrganizationRepository(
        create_client(settings.supabase_url, settings.supabase_secret_key)
    )
    print(process_due_schedules(repository, datetime.now(timezone.utc)))


if __name__ == "__main__":
    main()
