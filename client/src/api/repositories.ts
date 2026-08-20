export type GatedResult<T> =
  | { status: "completed"; data: T }
  | { status: "approval_required"; approval_id: string }
  | { status: "denied"; reason: string }
  | { status: "failed"; error: string };

export type RepoInfo = { default_branch: string; full_name: string; description: string | null; private: boolean };
export type TreeEntry = { path: string; type: "blob" | "tree"; size?: number };
export type CommitSummary = { sha: string; commit: { message: string; author: { name: string; date: string } }; html_url: string; author: { login: string } | null };
export type Branch = { name: string; commit: { sha: string } };
export type PullRequestSummary = { number: number; title: string; user: { login: string }; html_url: string; state: string };
export type PullRequestDetail = PullRequestSummary & { files: { filename: string; additions: number; deletions: number }[]; additions: number; deletions: number };
export type Contributor = { login: string; avatar_url: string; contributions: number };
export type Tag = { name: string; commit: { sha: string } };

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function request(token: string, path: string) {
  const response = await fetch(`${apiUrl}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || "Request failed");
  return response;
}

export const repositoryApi = {
  async repoInfo(token: string, workspaceId: string, connectionId: string): Promise<GatedResult<RepoInfo>> {
    return (await request(token, `/workspaces/${workspaceId}/repositories/${connectionId}`)).json();
  },
  async tree(token: string, workspaceId: string, connectionId: string, ref?: string): Promise<GatedResult<{ tree: TreeEntry[] }>> {
    const query = ref ? `?ref=${encodeURIComponent(ref)}` : "";
    return (await request(token, `/workspaces/${workspaceId}/repositories/${connectionId}/tree${query}`)).json();
  },
  async fileContent(token: string, workspaceId: string, connectionId: string, path: string, ref?: string): Promise<GatedResult<string>> {
    const query = new URLSearchParams({ path, ...(ref ? { ref } : {}) });
    return (await request(token, `/workspaces/${workspaceId}/repositories/${connectionId}/file?${query}`)).json();
  },
  async commits(token: string, workspaceId: string, connectionId: string, path?: string, ref?: string, limit = 30): Promise<GatedResult<CommitSummary[]>> {
    const query = new URLSearchParams({ limit: String(limit), ...(path ? { path } : {}), ...(ref ? { ref } : {}) });
    return (await request(token, `/workspaces/${workspaceId}/repositories/${connectionId}/commits?${query}`)).json();
  },
  async branches(token: string, workspaceId: string, connectionId: string): Promise<GatedResult<Branch[]>> {
    return (await request(token, `/workspaces/${workspaceId}/repositories/${connectionId}/branches`)).json();
  },
  async pullRequests(token: string, workspaceId: string, connectionId: string, state = "open"): Promise<GatedResult<PullRequestSummary[]>> {
    return (await request(token, `/workspaces/${workspaceId}/repositories/${connectionId}/pulls?state=${state}`)).json();
  },
  async pullRequest(token: string, workspaceId: string, connectionId: string, number: number): Promise<GatedResult<PullRequestDetail>> {
    return (await request(token, `/workspaces/${workspaceId}/repositories/${connectionId}/pulls/${number}`)).json();
  },
  async contributors(token: string, workspaceId: string, connectionId: string, limit = 20): Promise<GatedResult<Contributor[]>> {
    return (await request(token, `/workspaces/${workspaceId}/repositories/${connectionId}/contributors?limit=${limit}`)).json();
  },
  async tags(token: string, workspaceId: string, connectionId: string, limit = 10): Promise<GatedResult<Tag[]>> {
    return (await request(token, `/workspaces/${workspaceId}/repositories/${connectionId}/tags?limit=${limit}`)).json();
  },
  async compare(token: string, workspaceId: string, connectionId: string, base: string, head: string): Promise<GatedResult<{ files: { filename: string; patch?: string }[]; commits: unknown[] }>> {
    return (await request(token, `/workspaces/${workspaceId}/repositories/${connectionId}/compare?base=${encodeURIComponent(base)}&head=${encodeURIComponent(head)}`)).json();
  },
};
