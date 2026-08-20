export type CiConnection = { id: string; provider: "github_actions"; external_ref: string; manifest: Record<string, unknown>; enabled: boolean };
export type PipelineRun = {
  id: string;
  ci_connection_id: string;
  pipeline_name: string;
  branch: string | null;
  commit_sha: string | null;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  triggered_by: string | null;
  created_at: string;
  completed_at: string | null;
};
export type CiTriggerResult =
  | { status: "completed" }
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

export const cicdApi = {
  async listCiConnections(token: string, workspaceId: string): Promise<CiConnection[]> {
    return (await request(token, `/workspaces/${workspaceId}/ci-connections`)).json();
  },
  async createCiConnection(token: string, workspaceId: string, externalRef: string): Promise<CiConnection> {
    return (
      await request(token, `/workspaces/${workspaceId}/ci-connections`, {
        method: "POST",
        body: JSON.stringify({ provider: "github_actions", external_ref: externalRef }),
      })
    ).json();
  },
  async listPipelineRuns(token: string, workspaceId: string): Promise<PipelineRun[]> {
    return (await request(token, `/workspaces/${workspaceId}/pipeline-runs`)).json();
  },
  async registerCiCredential(token: string, workspaceId: string, connectionId: string, githubToken: string): Promise<void> {
    await request(token, `/workspaces/${workspaceId}/ci-connections/${connectionId}/credential`, {
      method: "POST",
      body: JSON.stringify({ token: githubToken }),
    });
  },
  async triggerPipeline(token: string, workspaceId: string, connectionId: string, workflowRef: string, gitRef = "main"): Promise<CiTriggerResult> {
    return (
      await request(token, `/workspaces/${workspaceId}/ci-connections/${connectionId}/trigger`, {
        method: "POST",
        body: JSON.stringify({ workflow_ref: workflowRef, git_ref: gitRef }),
      })
    ).json();
  },
};
