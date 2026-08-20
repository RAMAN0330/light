import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatApp } from "./ChatApp";

const api = {
  async createOrganization() { return { id: "org-1", name: "Acme", workspace: { id: "workspace-1", name: "Acme" } }; },
  async listWorkspaces() { return [{ id: "workspace-1", name: "Acme", role: "owner", organization_id: "org-1" }]; },
  async listMembers() { return [{ user_id: "user-1", role: "owner", created_at: "2026-08-14T00:00:00Z" }]; },
  async listSkills() { return [{ id: "skill-1", name: "Read-only research", version: "1.0.0", status: "draft" as const, manifest: { tools: ["web.search"], data_access: ["workspace.knowledge.read"] }, created_by: "user-1", created_at: "2026-08-14T00:00:00Z" }]; },
  async importUpstreamSkills() { return { imported: 1, skipped: 0 }; },
  async listPolicies() { return [{ id: "policy-1", action: "connector.invoke", decision: "require_approval" as const, enabled: true }]; },
  async listApprovalRequests() { return [{ id: "approval-1", action: "connector.invoke", summary: "Search a research source", status: "pending" as const }]; },
  async listArtifacts() { return [{ id: "artifact-1", name: "brief.md", status: "normalized" as const }]; },
  async uploadArtifact() { return { id: "artifact-2", name: "upload.md", status: "uploaded" as const }; },
  async normalizeArtifact() {},
  async listCollections() { return [{ id: "collection-1", name: "Research" }]; },
  async queryCollection() { return []; },
  async createResearchReport() { return { id: "report-1" }; },
  async createSkillObservation() { return { id: "observation-1" }; },
  async listTasks() { return []; },
  async listNotes() { return []; },
  async listNotifications() { return []; },
  async createTask() { return { id: "task-1", title: "Task", description: "", status: "open" as const }; },
  async createNote() { return { id: "note-1", title: "Note", content: "Text" }; },
  async updateTaskStatus() { return { id: "task-1", title: "Task", description: "", status: "done" as const }; },
  async listActivity() { return []; },
  async listSchedules() { return []; },
  async createSchedule() { return { id: "schedule-1", title: "Schedule", cron_expression: "0 9 * * 1-5", enabled: true }; },
  async setScheduleEnabled() { return { id: "schedule-1", title: "Schedule", cron_expression: "0 9 * * 1-5", enabled: false }; },
  async registerAdapter() { return { id: "adapter-1", enabled: false }; },
  async listProjects() { return []; },
  async createProject() { return { id: "project-1", name: "Project", instructions: "" }; },
  async updateProject() { return { id: "project-1", name: "Project", instructions: "" }; },
  async inviteProjectMember() {},
  async addProjectDocument() {},
  async listProjectDocuments() { return []; },
  async deleteProjectDocument() {},
  async listConversations() { return [{ id: "chat-1", title: "New chat" }]; },
  async listMessages() { return []; },
  async createConversation() { return { id: "chat-1", title: "New chat" }; },
  async deleteConversation() {},
  async renameConversation() {},
  async archiveConversation() {},
  async cancelAgentRun() {},
  async *sendMessage() { yield "Hi"; yield "!"; },
};

afterEach(cleanup);

beforeEach(() => {
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
});

async function openConversations() {
  await userEvent.click(await screen.findByRole("button", { name: "Conversations" }));
}

async function openWorkspaces() {
  await userEvent.click(await screen.findByRole("button", { name: /Workspaces/ }));
}

describe("ChatApp", () => {
  it("opens on an enterprise workspace overview instead of a chat", async () => {
    render(<ChatApp accessToken="token" api={api} />);

    expect(
      await screen.findByRole("heading", { name: /workspace overview/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Research & scraping" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Automations" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();
  });

  it("starts analysis work from the floating Orbital launcher", async () => {
    const sentModes: string[] = [];
    const launcherApi = {
      ...api,
      async *sendMessage(
        _token: string,
        _conversationId: string,
        _content: string,
        selectedMode = "ask",
      ) {
        sentModes.push(selectedMode);
        yield "Analysis started";
      },
    };
    render(<ChatApp accessToken="token" api={launcherApi} />);

    await userEvent.click(screen.getByRole("button", { name: "Ask Orbital" }));
    await userEvent.click(screen.getByRole("button", { name: "Analyze" }));
    await userEvent.type(screen.getByLabelText("Orbital request"), "Analyze this quarter");
    await userEvent.click(screen.getByRole("button", { name: "Start analysis" }));

    expect(await screen.findByText("Analysis started")).toBeInTheDocument();
    expect(sentModes).toEqual(["research"]);
  });

  it("shows the authenticated user's active Orbital workspace on the workspaces page", async () => {
    render(<ChatApp accessToken="token" api={api} />);

    await openWorkspaces();

    expect(await screen.findByRole("button", { name: /Acme/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("reaches workspaces from the sidebar instead of a dropdown", async () => {
    render(<ChatApp accessToken="token" api={api} />);

    const sidebar = screen.getByRole("complementary");
    expect(within(sidebar).queryByRole("combobox", { name: "Active Orbital workspace" })).not.toBeInTheDocument();
    await userEvent.click(await within(sidebar).findByRole("button", { name: /Workspaces/ }));
    expect(await screen.findByRole("button", { name: /Create workspace/ })).toBeInTheDocument();
  });

  it("places conversation search in the top bar", async () => {
    render(<ChatApp accessToken="token" api={api} />);
    await openConversations();

    const header = screen.getByRole("banner");
    const sidebar = screen.getByRole("complementary");
    expect(await within(header).findByLabelText("Search conversations")).toHaveClass("typewriter-search");
    expect(within(sidebar).queryByLabelText("Search conversations")).not.toBeInTheDocument();
  });

  it("lets a new user create their first workspace", async () => {
    const createOrganization = vi.fn().mockResolvedValue({
      id: "org-1",
      name: "Acme",
      workspace: { id: "workspace-1", name: "Acme" },
    });
    render(<ChatApp accessToken="token" api={{ ...api, listWorkspaces: async () => [], createOrganization }} />);

    await openWorkspaces();
    await userEvent.click(await screen.findByRole("button", { name: /Create workspace/ }));
    await userEvent.type(screen.getByLabelText("Workspace name"), "Acme");
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Create workspace" }));

    expect(createOrganization).toHaveBeenCalledWith("token", "Acme");
    expect(await screen.findByRole("button", { name: /Acme/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps workspace creation available after a workspace exists", async () => {
    render(<ChatApp accessToken="token" api={api} />);

    await openWorkspaces();
    await userEvent.click(await screen.findByRole("button", { name: /Create workspace/ }));

    expect(screen.getByLabelText("Workspace name")).toBeInTheDocument();
  });

  it("keeps workspace creation available after the first workspace exists", async () => {
    render(<ChatApp accessToken="token" api={api} />);

    await openWorkspaces();
    await userEvent.click(await screen.findByRole("button", { name: /Create workspace/ }));

    expect(screen.getByRole("heading", { name: "Create your first workspace" })).toBeInTheDocument();
  });

  it("shows the active workspace's governed skills", async () => {
    render(<ChatApp accessToken="token" api={api} />);

    await userEvent.click(await screen.findByRole("button", { name: "Skills" }));

    expect(await screen.findByRole("heading", { name: "Workspace skills" })).toBeInTheDocument();
    expect(screen.getByText("Read-only research")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("shows policy rules and pending approvals for the active workspace", async () => {
    render(<ChatApp accessToken="token" api={api} />);
    await userEvent.click(await screen.findByRole("button", { name: "Governance" }));

    expect(await screen.findByRole("heading", { name: "Workspace governance" })).toBeInTheDocument();
    expect(screen.getByText("connector.invoke")).toBeInTheDocument();
    expect(screen.getByText("Search a research source")).toBeInTheDocument();
  });

  it("normalizes a supported document after upload", async () => {
    const uploadArtifact = vi.fn().mockResolvedValue({ id: "artifact-2", name: "brief.docx", status: "uploaded" });
    const normalizeArtifact = vi.fn().mockResolvedValue(undefined);
    render(<ChatApp accessToken="token" api={{ ...api, uploadArtifact, normalizeArtifact }} />);

    await userEvent.click(await screen.findByRole("button", { name: "Knowledge" }));
    await userEvent.upload(screen.getByLabelText("Upload a document"), new File(["document"], "brief.docx", { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));

    expect(uploadArtifact).toHaveBeenCalledWith("token", "workspace-1", expect.any(File));
    expect(normalizeArtifact).toHaveBeenCalledWith("token", "artifact-2");
  });

  it("sends typed text and shows the streamed assistant reply", async () => {
    render(<ChatApp accessToken="token" api={api} />);
    await openConversations();
    await userEvent.type(await screen.findByLabelText("Message"), "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Hi!")).toBeInTheDocument();
  });

  it("renders the first assistant chunk before the stream completes", async () => {
    let releaseSecondChunk!: () => void;
    const pausedApi = {
      ...api,
      async *sendMessage() {
        yield "First";
        await new Promise<void>((resolve) => { releaseSecondChunk = resolve; });
        yield " second";
      },
    };
    render(<ChatApp accessToken="token" api={pausedApi} />);
    await openConversations();
    await userEvent.type(await screen.findByLabelText("Message"), "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("First")).toBeInTheDocument();
    releaseSecondChunk();
    expect(await screen.findByText("First second")).toBeInTheDocument();
  });

  it("batches rapid stream chunks into an animation-frame render", async () => {
    const requestFrame = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    const fastApi = { ...api, async *sendMessage() { yield "First"; yield " second"; } };
    render(<ChatApp accessToken="token" api={fastApi} />);
    await openConversations();

    await userEvent.type(await screen.findByLabelText("Message"), "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(requestFrame).toHaveBeenCalled();
    expect(await screen.findByText("First second")).toBeInTheDocument();
  });

  it("keeps streaming a background conversation while a new conversation is active", async () => {
    let finishFirstReply!: () => void;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      queueMicrotask(() => callback(0));
      return 1;
    });
    const concurrentApi = {
      ...api,
      async listConversations() { return [{ id: "chat-1", title: "First chat" }]; },
      async createConversation() { return { id: "chat-2", title: "Second chat" }; },
      async *sendMessage(_token: string, conversationId: string) {
        if (conversationId === "chat-1") {
          yield "First reply";
          await new Promise<void>((resolve) => { finishFirstReply = resolve; });
          yield " complete";
          return;
        }
        yield "Second reply";
      },
    };
    render(<ChatApp accessToken="token" api={concurrentApi} />);
    await openConversations();

    await userEvent.type(await screen.findByLabelText("Message"), "First prompt");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("First reply")).toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button", { name: "New conversation" })[0]);
    await userEvent.type(await screen.findByLabelText("Message"), "Second prompt");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Second reply")).toBeInTheDocument();

    finishFirstReply();
    await userEvent.click(screen.getAllByRole("button", { name: "First chat" })[0]);
    expect(await screen.findByText("First reply complete")).toBeInTheDocument();
  });

  it("lets a user cancel a streamed agent run", async () => {
    let release!: () => void;
    const cancelAgentRun = vi.fn().mockResolvedValue(undefined);
    const runningApi = {
      ...api,
      cancelAgentRun,
      async *sendMessage(_token: string, _conversationId: string, _content: string, _mode?: "ask" | "research" | "create", onRunStarted?: (runId: string) => void) {
        onRunStarted?.("run-1");
        yield "Working";
        await new Promise<void>((resolve) => { release = resolve; });
      },
    };
    render(<ChatApp accessToken="token" api={runningApi} />);
    await openConversations();
    await userEvent.type(await screen.findByLabelText("Message"), "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await userEvent.click(await screen.findByRole("button", { name: "Cancel run" }));

    expect(cancelAgentRun).toHaveBeenCalledWith("token", "run-1");
    release();
  });

  it("keeps a mobile-accessible new conversation control", async () => {
    render(<ChatApp accessToken="token" api={api} />);
    await openConversations();
    expect(await screen.findAllByRole("button", { name: "New conversation" })).toHaveLength(2);
  });

  it("places an Orbital suggestion in the composer without sending it", async () => {
    render(<ChatApp accessToken="token" api={api} />);
    await openConversations();
    await userEvent.click(await screen.findByRole("button", { name: /Plan/i }));
    expect(screen.getByLabelText("Message")).toHaveValue("Help me turn this idea into a clear plan.");
    expect(screen.queryByText("Hi!")).not.toBeInTheDocument();
  });

  it("sends with Enter while Shift+Enter keeps a line break", async () => {
    render(<ChatApp accessToken="token" api={api} />);
    await openConversations();
    const input = await screen.findByLabelText("Message");
    await userEvent.type(input, "First line");
    await userEvent.keyboard("{Shift>}{Enter}{/Shift}Second line");
    expect(input).toHaveValue("First line\nSecond line");
    await userEvent.keyboard("{Enter}");
    expect(await screen.findByText("Hi!")).toBeInTheDocument();
  });

  it("keeps the newest streamed message in view", async () => {
    render(<ChatApp accessToken="token" api={api} />);
    await openConversations();
    await userEvent.type(await screen.findByLabelText("Message"), "Hello");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    await screen.findByText("Hi!");
    expect(screen.getByRole("log")).toHaveTextContent("Hi!");
  });

  it("asks for confirmation before deleting a conversation", async () => {
    const deleteConversation = vi.fn();
    render(<ChatApp accessToken="token" api={{ ...api, deleteConversation }} />);
    await openConversations();
    await userEvent.click(await screen.findByRole("button", { name: "Delete New chat" }));
    expect(screen.getByText("Delete this conversation?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Delete conversation" }));
    expect(deleteConversation).toHaveBeenCalledWith("token", "chat-1");
  });

  it("formats streamed assistant answers as readable Markdown", async () => {
    const formattedApi = { ...api, async *sendMessage() { yield "## Answer\n\n- First point\n- Second point\n\n```ts\nconst ready = true;\n```"; } };
    render(<ChatApp accessToken="token" api={formattedApi} />);
    await openConversations();
    await userEvent.type(await screen.findByLabelText("Message"), "Format this");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("heading", { name: "Answer" })).toBeInTheDocument();
    expect(screen.getByText("First point")).toBeInTheDocument();
    expect(screen.getByText("const ready = true;")).toBeInTheDocument();
  });

  it("renders streamed GitHub-Flavored Markdown tables", async () => {
    const tableApi = { ...api, async *sendMessage() { yield "| Business Need | Example Skill | Desired Outcome |\n| --- | --- | --- |\n| **FAQ lookup** | `refund-policy` | Accurate answer |"; } };
    render(<ChatApp accessToken="token" api={tableApi} />);
    await openConversations();
    await userEvent.type(await screen.findByLabelText("Message"), "Show a table");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("columnheader", { name: "Business Need" })).toBeInTheDocument();
    expect(screen.getByText("FAQ lookup")).toBeInTheDocument();
  });

  it("renders accidentally indented prose as prose instead of a padded code block", async () => {
    const indentedApi = { ...api, async *sendMessage() { yield "    **Takeaway:** Write a one-sentence skill brief.\n\n    **Real-world example:** The OrderLookup skill returns shipment status."; } };
    render(<ChatApp accessToken="token" api={indentedApi} />);
    await openConversations();
    await userEvent.type(await screen.findByLabelText("Message"), "Format this");
    await userEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText(/Write a one-sentence skill brief/)).toBeInTheDocument();
    expect(document.querySelector(".assistant-content pre")).not.toBeInTheDocument();
  });
});
