from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.chat import router as chat_router
from app.api.organizations import router as organizations_router
from app.core.config import settings
from app.repositories.chat import SupabaseChatRepository
from app.repositories.organizations import SupabaseOrganizationRepository
from app.services.credentials import CredentialCipher
from app.services.openrouter import OpenRouterService
from app.services.provider_gateway import ProviderGateway


def create_app() -> FastAPI:
    app = FastAPI(title="Chatbot API")
    app.state.credential_cipher = (
        CredentialCipher(settings.orbital_encryption_key)
        if settings.orbital_encryption_key
        else None
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.orbital_cors_origins),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(chat_router)
    app.include_router(organizations_router)

    if settings.supabase_url and settings.supabase_publishable_key:
        from supabase import create_client

        supabase = create_client(
            settings.supabase_url, settings.supabase_publishable_key
        )
        app.state.supabase = supabase
        app.state.admin_supabase = create_client(settings.supabase_url, settings.supabase_secret_key) if settings.supabase_secret_key else None
        app.state.ai = OpenRouterService()
        app.state.provider_gateway = ProviderGateway(
            app.state.admin_supabase,
            app.state.credential_cipher,
            app.state.ai,
            lambda secret, model: OpenRouterService(api_key=secret, model=model),
        )

        def repository_for_token(access_token: str) -> SupabaseChatRepository:
            user_client = create_client(
                settings.supabase_url, settings.supabase_publishable_key
            )
            user_client.postgrest.auth(access_token)
            return SupabaseChatRepository(user_client)

        app.state.repository_for_token = repository_for_token
        def organization_repository_for_token(
            access_token: str,
        ) -> SupabaseOrganizationRepository:
            user_client = create_client(
                settings.supabase_url, settings.supabase_publishable_key
            )
            user_client.postgrest.auth(access_token)
            return SupabaseOrganizationRepository(user_client)

        app.state.organization_repository_for_token = organization_repository_for_token

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
