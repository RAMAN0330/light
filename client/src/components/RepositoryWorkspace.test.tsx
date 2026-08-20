import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { RepositoryWorkspace } from "./RepositoryWorkspace";

vi.mock("../api/cicd", () => ({
  cicdApi: {
    listCiConnections: vi.fn().mockResolvedValue([]),
    createCiConnection: vi.fn(),
  },
}));

describe("RepositoryWorkspace", () => {
  it("shows a connect prompt when the workspace has no repository connections", async () => {
    render(<RepositoryWorkspace accessToken="token" workspaceId="workspace-1" />);

    expect(await screen.findByPlaceholderText("org/repo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Connect a repository/i })).toBeInTheDocument();
  });
});
