export type InfraConnection = { id: string; kind: "docker_host" | "k8s_cluster"; name: string; manifest: Record<string, unknown>; enabled: boolean };
export type InfraResourceType = "container" | "image" | "pod" | "deployment";
export type InfraAction = "start" | "stop" | "restart" | "delete" | "scale";
export type InfraGatewayResult =
  | { status: "completed"; items: Record<string, unknown>[] }
  | { status: "approval_required"; approval_id: string }
  | { status: "denied"; reason: string }
  | { status: "unavailable"; reason: string };
export type InfraLogsResult =
  | { status: "completed"; output: string }
  | { status: "approval_required"; approval_id: string }
  | { status: "denied"; reason: string }
  | { status: "unavailable"; reason: string };
export type InfraActionResult =
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

export const infraApi = {
  async listInfraConnections(token: string, workspaceId: string): Promise<InfraConnection[]> {
    return (await request(token, `/workspaces/${workspaceId}/infra-connections`)).json();
  },
  async createInfraConnection(token: string, workspaceId: string, kind: InfraConnection["kind"], name: string): Promise<InfraConnection> {
    return (
      await request(token, `/workspaces/${workspaceId}/infra-connections`, {
        method: "POST",
        body: JSON.stringify({ kind, name }),
      })
    ).json();
  },
  async listResources(token: string, workspaceId: string, connectionId: string, resourceType: InfraResourceType): Promise<InfraGatewayResult> {
    return (await request(token, `/workspaces/${workspaceId}/infra/${connectionId}/${resourceType}`)).json();
  },
  async resourceLogs(token: string, workspaceId: string, connectionId: string, resourceType: InfraResourceType, resourceRef: string): Promise<InfraLogsResult> {
    return (await request(token, `/workspaces/${workspaceId}/infra/${connectionId}/${resourceType}/${encodeURIComponent(resourceRef)}/logs`)).json();
  },
  async performAction(
    token: string,
    workspaceId: string,
    connectionId: string,
    resourceType: InfraResourceType,
    resourceRef: string,
    action: InfraAction,
    replicas?: number,
  ): Promise<InfraActionResult> {
    return (
      await request(token, `/workspaces/${workspaceId}/infra/${connectionId}/${resourceType}/${encodeURIComponent(resourceRef)}/actions`, {
        method: "POST",
        body: JSON.stringify({ action, ...(replicas !== undefined ? { replicas } : {}) }),
      })
    ).json();
  },
};
