from app.services.provider_gateway import ProviderGateway


def test_provider_gateway_uses_the_organization_credential_without_exposing_it():
    class Table:
        def select(self, _fields):
            return self

        def eq(self, _field, _value):
            return self

        def is_(self, _field, _value):
            return self

        def order(self, _field, **_kwargs):
            return self

        def limit(self, _value):
            return self

        def execute(self):
            return type("Result", (), {"data": [{"encrypted_secret": "ciphertext", "model": "provider/model"}]})()

    admin = type("Admin", (), {"table": lambda *_: Table()})()
    cipher = type("Cipher", (), {"decrypt": lambda *_: "sk-provider"})()
    gateway = ProviderGateway(admin, cipher, fallback="fallback", factory=lambda secret, model: (secret, model))

    assert gateway.ai_for_organization("org-1") == ("sk-provider", "provider/model")
