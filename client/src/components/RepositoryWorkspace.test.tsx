import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RepositoryWorkspace } from "./RepositoryWorkspace";

const connection = { id: "connection-1", workspace_id: "workspace-1", provider: "github_actions" as const, external_ref: "acme/widgets", manifest: {}, enabled: true };

vi.mock("../api/cicd", () => ({
  cicdApi: {
    listCiConnections: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../api/repositories", () => ({
  repositoryApi: {
    repoInfo: vi.fn().mockResolvedValue({ status: "completed", data: { default_branch: "main", full_name: "acme/widgets", description: null, private: false } }),
    branches: vi.fn().mockResolvedValue({ status: "completed", data: [] }),
    pullRequests: vi.fn().mockResolvedValue({ status: "completed", data: [] }),
    contributors: vi.fn().mockResolvedValue({ status: "completed", data: [] }),
    commitAnalyses: vi.fn().mockResolvedValue([]),
    commits: vi.fn().mockResolvedValue({ status: "completed", data: [] }),
    tree: vi.fn().mockResolvedValue({ status: "completed", data: { tree: [{ path: "index.ts", type: "blob" }] } }),
    fileContent: vi.fn().mockResolvedValue({ status: "completed", data: "export const x = 1;" }),
    analyze: vi.fn(),
  },
}));

describe("RepositoryWorkspace", () => {
  it("renders the workspace shell without a repository connect prompt", async () => {
    render(<RepositoryWorkspace accessToken="token" workspaceId="workspace-1" onNavigateToWorkspace={vi.fn()} />);

    expect(await screen.findByText("Repositories")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("org/repo")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Connect a repository/i })).not.toBeInTheDocument();
  });

  it("opens a blocking first-run analysis overlay for a freshly created project's repository", async () => {
    const { cicdApi } = await import("../api/cicd");
    vi.mocked(cicdApi.listCiConnections).mockResolvedValue([connection]);
    const onAutoAnalyzeConsumed = vi.fn();

    render(
      <RepositoryWorkspace
        accessToken="token"
        workspaceId="workspace-1"
        onNavigateToWorkspace={vi.fn()}
        initialConnectionId="connection-1"
        autoAnalyze
        onAutoAnalyzeConsumed={onAutoAnalyzeConsumed}
      />,
    );

    expect(await screen.findByRole("dialog", { name: /Analyzing acme\/widgets/ })).toBeInTheDocument();
    expect(onAutoAnalyzeConsumed).toHaveBeenCalled();

    const continueButton = await screen.findByRole("button", { name: "Continue to project" });
    await userEvent.click(continueButton);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: /Analyzing acme\/widgets/ })).not.toBeInTheDocument());
  });
});
