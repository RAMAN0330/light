from typing import Optional


class ProviderGateway:
    def __init__(self, admin, cipher, fallback, factory) -> None:
        self.admin = admin
        self.cipher = cipher
        self.fallback = fallback
        self.factory = factory

    def ai_for_organization(self, organization_id: Optional[str]):
        if not organization_id or not self.admin or not self.cipher:
            return self.fallback
        credentials = (
            self.admin.table("provider_credentials")
            .select("encrypted_secret,model")
            .eq("organization_id", organization_id)
            .is_("revoked_at", "null")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
            .data
        )
        if not credentials:
            return self.fallback
        credential = credentials[0]
        return self.factory(self.cipher.decrypt(credential["encrypted_secret"]), credential["model"])
