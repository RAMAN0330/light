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
  async inviteWorkspaceMember() {},
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
  if (!screen.queryByRole("complementary")) {
    await userEvent.click(await screen.findByRole("button", { name: /Acme/ }));
  }
  await userEvent.click(await screen.findByRole("button", { name: "Conversations" }));
}

async function openWorkspaces() {
  await screen.findByRole("heading", { name: /Your workspaces/i });
}

async function enterWorkspace() {
  await userEvent.click(await screen.findByRole("button", { name: /Acme/ }));
}

describe("ChatApp", () => {
  it("opens on an organization picker instead of a workspace dashboard", async () => {
    render(<ChatApp accessToken="token" api={api} />);

    expect(await screen.findByRole("heading", { name: /your workspaces/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Acme/ })).toBeInTheDocument();
    expect(document.querySelector(".workspace-sidebar")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();
  });

  it("shows the authenticated user's active Orbital workspace on the workspaces page", async () => {
    render(<ChatApp accessToken="token" api={api} />);

    await openWorkspaces();

    expect(await screen.findByRole("button", { name: /Acme/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps the workspace picker outside the workspace sidebar", async () => {
    render(<ChatApp accessToken="token" api={api} />);

    expect(await screen.findByRole("heading", { name: /Your workspaces/i })).toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New workspace" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask Orbital" })).not.toBeInTheDocument();
  });

  it("opens the detailed project screen without a sidebar after selecting a workspace", async () => {
    render(<ChatApp accessToken="token" api={api} />);

    await userEvent.click(await screen.findByRole("button", { name: /Acme/ }));

    expect(await screen.findByRole("heading", { name: /start your first project/i })).toBeInTheDocument();
    expect(document.querySelector(".workspace-sidebar")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ask Orbital" })).not.toBeInTheDocument();
  });

  it("offers a repository connection while creating a project", async () => {
    render(<ChatApp accessToken="token" api={api} />);

    await userEvent.click(await screen.findByRole("button", { name: /Acme/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Create project" }));

    expect(screen.getByLabelText("Repository")).toHaveAttribute("placeholder", "owner/repository");
    expect(screen.getByRole("button", { name: "Verify repository" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Private repository" })).not.toBeChecked();
    expect(screen.queryByLabelText("GitHub personal access token")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Private repository" }));
    expect(screen.getByLabelText("GitHub personal access token")).toHaveAttribute("type", "password");
  });

  it("adds the expandable workspace navigation to a selected project", async () => {
    render(<ChatApp accessToken="token" api={{ ...api, listProjects: async () => [{ id: "project-1", name: "Platform", instructions: "Release planning" }] }} />);

    await userEvent.click(await screen.findByRole("button", { name: /Acme/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Open project" }));

    expect(await screen.findByText("Workspace")).toBeInTheDocument();
    expect(await screen.findByText("Projects")).toBeInTheDocument();
    expect(await screen.findByText("Overview")).toBeInTheDocument();
    expect(document.querySelector(".workspace-sidebar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep navigation expanded" })).toBeInTheDocument();
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
    await userEvent.click(await screen.findByRole("button", { name: "New workspace" }));
    await userEvent.type(screen.getByLabelText("Workspace name"), "Acme");
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Create workspace" }));

    expect(createOrganization).toHaveBeenCalledWith("token", "Acme");
    expect(await screen.findByRole("button", { name: /Acme/ })).toHaveAttribute("aria-pressed", "true");
  });

  it("keeps workspace creation available after a workspace exists", async () => {
    render(<ChatApp accessToken="token" api={api} />);

    await openWorkspaces();
    await userEvent.click(await screen.findByRole("button", { name: "New workspace" }));

    expect(screen.getByLabelText("Workspace name")).toBeInTheDocument();
  });

  it("keeps workspace creation available after the first workspace exists", async () => {
    render(<ChatApp accessToken="token" api={api} />);

    await openWorkspaces();
    await userEvent.click(await screen.findByRole("button", { name: "New workspace" }));

    expect(screen.getByRole("heading", { name: "Create your first workspace" })).toBeInTheDocument();
  });

  it("shows the active workspace's governed skills", async () => {
    render(<ChatApp accessToken="token" api={api} />);
    await enterWorkspace();

    await userEvent.click(await screen.findByRole("button", { name: "Skills" }));

    expect(await screen.findByRole("heading", { name: "Workspace skills" })).toBeInTheDocument();
    expect(screen.getByText("Read-only research")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("shows policy rules and pending approvals for the active workspace", async () => {
    render(<ChatApp accessToken="token" api={api} />);
    await enterWorkspace();
    await userEvent.click(await screen.findByRole("button", { name: "Governance" }));

    expect(await screen.findByRole("heading", { name: "Workspace governance" })).toBeInTheDocument();
    expect(screen.getByText("connector.invoke")).toBeInTheDocument();
    expect(screen.getByText("Search a research source")).toBeInTheDocument();
  });

  it("normalizes a supported document after upload", async () => {
    const uploadArtifact = vi.fn().mockResolvedValue({ id: "artifact-2", name: "brief.docx", status: "uploaded" });
    const normalizeArtifact = vi.fn().mockResolvedValue(undefined);
    render(<ChatApp accessToken="token" api={{ ...api, uploadArtifact, normalizeArtifact }} />);
    await enterWorkspace();

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

  it("does not show the floating Orbital launcher in conversations", async () => {
    render(<ChatApp accessToken="token" api={api} />);
    await openConversations();

    expect(screen.queryByRole("button", { name: "Ask Orbital" })).not.toBeInTheDocument();
  });

  it("maps command-composer quick actions to the existing response modes", async () => {
    render(<ChatApp accessToken="token" api={api} />);
    await openConversations();

    await userEvent.click(await screen.findByRole("button", { name: "Analyze data" }));
    expect(screen.getByRole("combobox", { name: "Response mode" })).toHaveValue("research");

    await userEvent.click(screen.getByRole("button", { name: "Get insights" }));
    expect(screen.getByRole("combobox", { name: "Response mode" })).toHaveValue("ask");
  });

  it("keeps the compact composer free of redundant support copy", async () => {
    render(<ChatApp accessToken="token" api={api} />);
    await userEvent.click(await screen.findByRole("button", { name: /Acme/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Conversations" }));

    expect(screen.queryByText("Ask anything or describe what you need assistance with.")).not.toBeInTheDocument();
  });

  it("renders the composer input without its own visual boundary", async () => {
    render(<ChatApp accessToken="token" api={api} />);
    await openConversations();

    expect(await screen.findByLabelText("Message")).toHaveClass(
      "!border-0",
      "!bg-transparent",
      "!shadow-none",
    );
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
