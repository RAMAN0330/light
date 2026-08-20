import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Settings:
    openrouter_api_key: str = os.getenv("OPENROUTER_API_KEY", "")
    supabase_url: str = os.getenv("SUPABASE_URL", "")
    supabase_publishable_key: str = os.getenv("SUPABASE_PUBLISHABLE_KEY", "")
    supabase_secret_key: str = os.getenv("SUPABASE_SECRET_KEY", "")
    orbital_encryption_key: str = os.getenv("ORBITAL_ENCRYPTION_KEY", "")
    orbital_schedule_worker_enabled: bool = os.getenv("ORBITAL_SCHEDULE_WORKER_ENABLED", "false").lower() == "true"
    orbital_runner_url: str = os.getenv("ORBITAL_RUNNER_URL", "")
    orbital_runner_token: str = os.getenv("ORBITAL_RUNNER_TOKEN", "")
    orbital_infra_agent_url: str = os.getenv("ORBITAL_INFRA_AGENT_URL", "")
    orbital_infra_agent_token: str = os.getenv("ORBITAL_INFRA_AGENT_TOKEN", "")
    orbital_ci_sync_enabled: bool = os.getenv("ORBITAL_CI_SYNC_ENABLED", "false").lower() == "true"
    github_api_url: str = os.getenv("GITHUB_API_URL", "https://api.github.com")
    github_webhook_secret: str = os.getenv("GITHUB_WEBHOOK_SECRET", "")
    # Deployment-wide PAT used only for the phase-1 read-only poll fallback.
    # Public repos work without it (rate-limited to 60 req/hr). Per-workspace
    # credentials are a later phase, once the webhook path is validated.
    github_poll_token: str = os.getenv("GITHUB_POLL_TOKEN", "")
    # Personal GitHub OAuth (repo-discovery picker only; see 20260823_orbital_github_oauth.sql).
    github_oauth_client_id: str = os.getenv("GITHUB_OAUTH_CLIENT_ID", "")
    github_oauth_client_secret: str = os.getenv("GITHUB_OAUTH_CLIENT_SECRET", "")
    github_oauth_redirect_uri: str = os.getenv("GITHUB_OAUTH_REDIRECT_URI", "http://localhost:8000/auth/github/callback")
    orbital_cors_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv("ORBITAL_CORS_ORIGINS", "http://localhost:5173").split(",")
        if origin.strip()
    )
    openrouter_model: str = os.getenv(
        "OPENROUTER_MODEL", "nvidia/nemotron-3-nano-30b-a3b:free"
    )


settings = Settings()
