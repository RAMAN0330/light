"""Personal GitHub OAuth: powers a "browse my repos" discovery picker only.

The resulting token is never used to create or gate the actual workspace
repository connection — that stays the existing ci_connections/ci_credentials
flow (workspace-scoped, admin-registered, auditable). This is deliberately a
narrower trust boundary: a linked personal identity can only list repos it
has access to; picking one still goes through the normal, governed
create_ci_connection path.
"""
from __future__ import annotations

from urllib.parse import urlencode

import httpx

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"


class GitHubOAuthError(ValueError):
    pass


def authorize_url(client_id: str, redirect_uri: str, state: str) -> str:
    params = {"client_id": client_id, "redirect_uri": redirect_uri, "scope": "repo", "state": state}
    return f"{GITHUB_AUTHORIZE_URL}?{urlencode(params)}"


async def exchange_code(client_id: str, client_secret: str, redirect_uri: str, code: str, client: httpx.AsyncClient | None = None) -> str:
    payload = {"client_id": client_id, "client_secret": client_secret, "redirect_uri": redirect_uri, "code": code}
    headers = {"Accept": "application/json"}
    if client:
        response = await client.post(GITHUB_TOKEN_URL, data=payload, headers=headers)
    else:
        async with httpx.AsyncClient(timeout=20.0) as new_client:
            response = await new_client.post(GITHUB_TOKEN_URL, data=payload, headers=headers)
    response.raise_for_status()
    data = response.json()
    token = data.get("access_token")
    if not token:
        raise GitHubOAuthError(data.get("error_description") or data.get("error") or "GitHub did not return an access token")
    return token
