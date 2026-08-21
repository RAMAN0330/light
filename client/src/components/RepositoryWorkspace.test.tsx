import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RepositoryWorkspace } from "./RepositoryWorkspace";

vi.mock("../api/cicd", () => ({
  cicdApi: {
    listCiConnections: vi.fn().mockResolvedValue([]),
  },
}));

describe("RepositoryWorkspace", () => {
  it("renders the workspace shell without a repository connect prompt", async () => {
    render(<RepositoryWorkspace accessToken="token" workspaceId="workspace-1" onNavigateToWorkspace={vi.fn()} />);

    expect(await screen.findByText("Repositories")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("org/repo")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Connect a repository/i })).not.toBeInTheDocument();
  });
});
