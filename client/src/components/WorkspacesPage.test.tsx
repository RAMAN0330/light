import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { WorkspacesPage } from "./WorkspacesPage";

afterEach(cleanup);

describe("WorkspacesPage", () => {
  it("shows each workspace as an individual panel", () => {
    render(
      <WorkspacesPage
        workspaces={[
          { id: "workspace-1", name: "Product", role: "owner", organization_id: "org-1" },
          { id: "workspace-2", name: "Research", role: "member", organization_id: "org-1" },
        ]}
        workspaceId="workspace-1"
        workspaceInviteEmail=""
        onSelectWorkspace={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onCreateWorkspace={vi.fn()}
        onWorkspaceInviteEmailChange={vi.fn()}
        onInviteWorkspaceMember={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Workspace list")).toBeInTheDocument();
    expect(screen.getByText("Product")).toBeInTheDocument();
    expect(screen.getByText("Research")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Open" })).toHaveLength(2);
    expect(screen.queryByRole("heading", { name: "Workspace details" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Invite members to this workspace" })).toBeInTheDocument();
  });

  it("opens the account menu from the compact workspace top bar", async () => {
    const onSignOut = vi.fn();
    render(
      <WorkspacesPage
        workspaces={[]}
        workspaceId="workspace-1"
        workspaceInviteEmail=""
        onSelectWorkspace={vi.fn()}
        onOpenWorkspace={vi.fn()}
        onCreateWorkspace={vi.fn()}
        onWorkspaceInviteEmailChange={vi.fn()}
        onInviteWorkspaceMember={vi.fn()}
        onSignOut={onSignOut}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });
});
