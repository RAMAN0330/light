from cryptography.fernet import Fernet

from app.services.credentials import CredentialCipher


def test_credential_cipher_round_trips_a_provider_secret():
    cipher = CredentialCipher(Fernet.generate_key().decode())

    encrypted = cipher.encrypt("provider-secret")

    assert encrypted != "provider-secret"
    assert cipher.decrypt(encrypted) == "provider-secret"
