import pytest

from app.services.github_oauth import GitHubOAuthError, authorize_url, exchange_code


def test_authorize_url_encodes_client_id_redirect_and_state():
    url = authorize_url("client-123", "https://orbital.example/auth/github/callback", "conn-1")

    assert url.startswith("https://github.com/login/oauth/authorize?")
    assert "client_id=client-123" in url
    assert "state=conn-1" in url
    assert "scope=repo" in url
    assert "redirect_uri=https%3A%2F%2Forbital.example%2Fauth%2Fgithub%2Fcallback" in url


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def raise_for_status(self):
        pass

    def json(self):
        return self.payload


class FakeClient:
    def __init__(self, payload):
        self.payload = payload
        self.calls = []

    async def post(self, url, data=None, headers=None):
        self.calls.append((url, data, headers))
        return FakeResponse(self.payload)


@pytest.mark.asyncio
async def test_exchange_code_returns_the_access_token():
    client = FakeClient({"access_token": "gho_abc123", "scope": "repo", "token_type": "bearer"})

    token = await exchange_code("client-123", "secret", "https://orbital.example/callback", "code-1", client)

    assert token == "gho_abc123"
    assert client.calls == [("https://github.com/login/oauth/access_token", {"client_id": "client-123", "client_secret": "secret", "redirect_uri": "https://orbital.example/callback", "code": "code-1"}, {"Accept": "application/json"})]


@pytest.mark.asyncio
async def test_exchange_code_raises_when_github_returns_an_error():
    client = FakeClient({"error": "bad_verification_code", "error_description": "The code passed is incorrect or expired."})

    with pytest.raises(GitHubOAuthError):
        await exchange_code("client-123", "secret", "https://orbital.example/callback", "code-1", client)
