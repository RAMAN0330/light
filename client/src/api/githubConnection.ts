export type ExternalConnection = { id: string; provider: string; scopes: string[]; status: "pending_authorization" | "active" | "revoked" };
export type GitHubRepo = { id: number; full_name: string; private: boolean; description: string | null; language: string | null; default_branch: string; updated_at: string };
export type GatedRepos =
  | { status: "completed"; data: GitHubRepo[] }
  | { status: "approval_required"; approval_id: string }
  | { status: "denied"; reason: string }
  | { status: "unavailable"; reason: string }
  | { status: "failed"; error: string };

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(token: string, path: string, options: RequestInit = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || "Request failed");
  return response;
}

export const githubConnectionApi = {
  async listExternalConnections(token: string, workspaceId: string): Promise<ExternalConnection[]> {
    return (await request(token, `/workspaces/${workspaceId}/external-connections`)).json();
  },
  async startGithubConnection(token: string, workspaceId: string): Promise<ExternalConnection | { decision: string; approval: unknown }> {
    return (
      await request(token, `/workspaces/${workspaceId}/external-connections`, {
        method: "POST",
        body: JSON.stringify({ provider: "github", scopes: ["repo"] }),
      })
    ).json();
  },
  async authorizeUrl(token: string, workspaceId: string, connectionId: string): Promise<{ authorize_url: string }> {
    return (await request(token, `/workspaces/${workspaceId}/external-connections/${connectionId}/github/authorize`)).json();
  },
  async repos(token: string, workspaceId: string, connectionId: string): Promise<GatedRepos> {
    return (await request(token, `/workspaces/${workspaceId}/external-connections/${connectionId}/github/repos`)).json();
  },
};
