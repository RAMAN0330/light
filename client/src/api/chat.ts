export type Conversation = { id: string; title: string; project_id?: string | null; created_at?: string };
export type Message = { role: "user" | "assistant"; content: string };
export type Project = { id: string; name: string; instructions: string; repository_connection_id?: string | null; created_at?: string };
export type ProjectDocument = { id: string; name: string; created_at?: string };
export type Workspace = { id: string; name: string; role: string; organization_id: string };
export type OrganizationMember = { user_id: string; role: string; created_at: string };
export type Policy = { id: string; action: string; decision: "allow" | "require_approval" | "deny"; enabled: boolean };
export type ApprovalRequest = { id: string; action: string; summary: string; status: "pending" | "approved" | "denied"; requested_by?: string; created_at?: string };
export type IntelligenceAdapter = "graphify" | "graft" | "headroom" | "agent_reach";
export type WorkspaceTask = { id: string; title: string; description: string; status: "open" | "in_progress" | "done" | "cancelled" };
export type WorkspaceNote = { id: string; title: string; content: string };
export type Notification = { id: string; title: string; body: string; read_at: string | null };
export type WorkspaceSchedule = { id: string; title: string; cron_expression: string; enabled: boolean };
export type Organization = { id: string; name: string; workspace: Pick<Workspace, "id" | "name"> };
export type ChatMode = "ask" | "research" | "create";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:8000";

type StreamEvent = { type: "run" | "delta" | "done" | "error"; text?: string; message?: string; run_id?: string };

export function extractSseEvents(buffer: string): { events: StreamEvent[]; remaining: string } {
  const parts = buffer.split("\n\n");
  const remaining = parts.pop() || "";
  const events = parts.flatMap((part) => {
    const data = part.split("\n").find((line) => line.startsWith("data: "))?.slice(6);
    if (!data) return [];
    try {
      const event = JSON.parse(data);
      return [{ type: event.type || "delta", text: event.text, message: event.message, run_id: event.run_id } as StreamEvent];
    } catch { return []; }
  });
  return { events, remaining };
}

async function request(token: string, path: string, options: RequestInit = {}) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers },
  });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || "Request failed");
  return response;
}

export const chatApi = {
  async createOrganization(token: string, name: string): Promise<Organization> {
    return (await request(token, "/organizations", { method: "POST", body: JSON.stringify({ name }) })).json();
  },
  async listWorkspaces(token: string): Promise<Workspace[]> {
    return (await request(token, "/workspaces")).json();
  },
  async deleteWorkspace(token: string, workspaceId: string, name: string): Promise<void> { await request(token, `/workspaces/${workspaceId}`, { method: "DELETE", body: JSON.stringify({ name }) }); },
  async inviteWorkspaceMember(token: string, workspaceId: string, email: string): Promise<void> {
    await request(token, `/workspaces/${workspaceId}/invites`, { method: "POST", body: JSON.stringify({ email }) });
  },
  async listMembers(token: string, organizationId: string): Promise<OrganizationMember[]> {
    return (await request(token, `/organizations/${organizationId}/members`)).json();
  },
  async listPolicies(token: string, workspaceId: string): Promise<Policy[]> {
    return (await request(token, `/workspaces/${workspaceId}/policies`)).json();
  },
  async listApprovalRequests(token: string, workspaceId: string): Promise<ApprovalRequest[]> {
    return (await request(token, `/workspaces/${workspaceId}/approval-requests`)).json();
  },
  async registerAdapter(token: string, workspaceId: string, name: IntelligenceAdapter): Promise<{ id: string; enabled: boolean }> { return (await request(token, `/workspaces/${workspaceId}/adapters`, { method: "POST", body: JSON.stringify({ name, manifest: {} }) })).json(); },
  async createSkillObservation(token: string, workspaceId: string, title: string): Promise<{ id: string }> { return (await request(token, `/workspaces/${workspaceId}/skill-observations`, { method: "POST", body: JSON.stringify({ title, manifest: { tools: [], data_access: [] } }) })).json(); },
  async listTasks(token: string, workspaceId: string): Promise<WorkspaceTask[]> { return (await request(token, `/workspaces/${workspaceId}/tasks`)).json(); },
  async listNotes(token: string, workspaceId: string): Promise<WorkspaceNote[]> { return (await request(token, `/workspaces/${workspaceId}/notes`)).json(); },
  async listNotifications(token: string, workspaceId: string): Promise<Notification[]> { return (await request(token, `/workspaces/${workspaceId}/notifications`)).json(); },
  async createTask(token: string, workspaceId: string, title: string): Promise<WorkspaceTask> { return (await request(token, `/workspaces/${workspaceId}/tasks`, { method: "POST", body: JSON.stringify({ title }) })).json(); },
  async createNote(token: string, workspaceId: string, title: string, content: string): Promise<WorkspaceNote> { return (await request(token, `/workspaces/${workspaceId}/notes`, { method: "POST", body: JSON.stringify({ title, content }) })).json(); },
  async updateTaskStatus(token: string, taskId: string, status: WorkspaceTask["status"]): Promise<WorkspaceTask> { return (await request(token, `/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify({ status }) })).json(); },
  async listActivity(token: string, workspaceId: string): Promise<{ id: string; action: string; resource_type: string }[]> { return (await request(token, `/workspaces/${workspaceId}/activity`)).json(); },
  async listSchedules(token: string, workspaceId: string): Promise<WorkspaceSchedule[]> { return (await request(token, `/workspaces/${workspaceId}/schedules`)).json(); },
  async createSchedule(token: string, workspaceId: string, title: string, cronExpression: string): Promise<WorkspaceSchedule> { return (await request(token, `/workspaces/${workspaceId}/schedules`, { method: "POST", body: JSON.stringify({ title, cron_expression: cronExpression }) })).json(); },
  async setScheduleEnabled(token: string, scheduleId: string, enabled: boolean): Promise<WorkspaceSchedule> { return (await request(token, `/schedules/${scheduleId}`, { method: "PATCH", body: JSON.stringify({ enabled }) })).json(); },
  async listConversations(token: string): Promise<Conversation[]> {
    return (await request(token, "/conversations")).json();
  },
  async listProjects(token: string): Promise<Project[]> { return (await request(token, "/projects")).json(); },
  async createProject(token: string, name: string, instructions = "", repositoryConnectionId?: string): Promise<Project> { return (await request(token, "/projects", { method: "POST", body: JSON.stringify({ name, instructions, ...(repositoryConnectionId ? { repository_connection_id: repositoryConnectionId } : {}) }) })).json(); },
  async updateProject(token: string, projectId: string, name: string, instructions: string): Promise<Project> { return (await request(token, `/projects/${projectId}`, { method: "PATCH", body: JSON.stringify({ name, instructions }) })).json(); },
  async deleteProject(token: string, projectId: string, name: string): Promise<void> { await request(token, `/projects/${projectId}`, { method: "DELETE", body: JSON.stringify({ name }) }); },
  async inviteProjectMember(token: string, projectId: string, email: string): Promise<void> { await request(token, `/projects/${projectId}/invites`, { method: "POST", body: JSON.stringify({ email }) }); },
  async addProjectDocument(token: string, projectId: string, name: string, content: string): Promise<void> { await request(token, `/projects/${projectId}/documents`, { method: "POST", body: JSON.stringify({ name, content }) }); },
  async listProjectDocuments(token: string, projectId: string): Promise<ProjectDocument[]> { return (await request(token, `/projects/${projectId}/documents`)).json(); },
  async deleteProjectDocument(token: string, documentId: string): Promise<void> { await request(token, `/project-documents/${documentId}`, { method: "DELETE" }); },
  async createConversation(token: string, projectId = "", workspaceId = ""): Promise<Conversation> {
    return (await request(token, "/conversations", { method: "POST", body: JSON.stringify({ ...(projectId ? { project_id: projectId } : {}), ...(workspaceId ? { workspace_id: workspaceId } : {}) }) })).json();
  },
  async listMessages(token: string, conversationId: string): Promise<Message[]> {
    return (await request(token, `/conversations/${conversationId}/messages`)).json();
  },
  async deleteConversation(token: string, conversationId: string): Promise<void> {
    await request(token, `/conversations/${conversationId}`, { method: "DELETE" });
  },
  async renameConversation(token: string, conversationId: string, title: string): Promise<void> {
    await request(token, `/conversations/${conversationId}`, { method: "PATCH", body: JSON.stringify({ title }) });
  },
  async archiveConversation(token: string, conversationId: string): Promise<void> {
    await request(token, `/conversations/${conversationId}/archive`, { method: "POST" });
  },
  async cancelAgentRun(token: string, runId: string): Promise<void> {
    await request(token, `/agent-runs/${runId}/cancel`, { method: "POST" });
  },
  async *sendMessage(token: string, conversationId: string, content: string, mode: ChatMode = "ask", onRunStarted?: (runId: string) => void): AsyncGenerator<string> {
    const response = await request(token, "/chat", {
      method: "POST",
      body: JSON.stringify({ conversation_id: conversationId, content, mode }),
    });
    if (!response.body) throw new Error("Live response did not include a stream.");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let completed = false;
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const parsed = extractSseEvents(buffer);
      buffer = parsed.remaining;
      for (const event of parsed.events) {
        if (event.type === "run" && event.run_id) onRunStarted?.(event.run_id);
        if (event.type === "delta" && event.text) yield event.text;
        if (event.type === "done") {
          completed = true;
          break;
        }
        if (event.type === "error") throw new Error(event.message || "Live connection failed.");
      }
      if (completed) return;
      if (done) break;
    }
    if (!completed) throw new Error("Live connection closed before the reply finished.");
  },
};
