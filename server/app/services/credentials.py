from cryptography.fernet import Fernet


class CredentialCipher:
    def __init__(self, key: str) -> None:
        self.fernet = Fernet(key.encode())

    def encrypt(self, secret: str) -> str:
        return self.fernet.encrypt(secret.encode()).decode()

    def decrypt(self, encrypted_secret: str) -> str:
        return self.fernet.decrypt(encrypted_secret.encode()).decode()
