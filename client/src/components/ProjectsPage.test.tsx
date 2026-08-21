import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProjectsPage } from "./ProjectsPage";

describe("ProjectsPage", () => {
  it("shows project details and lets the user switch projects from the left panel", async () => {
    const onSelectProject = vi.fn();
    const onSignOut = vi.fn();
    const user = userEvent.setup();
    render(
      <ProjectsPage
        projects={[
          { id: "project-1", name: "Launch plan", instructions: "Ship the next release." },
          { id: "project-2", name: "Website refresh", instructions: "Refresh the marketing site." },
        ]}
        selectedProjectId="project-1"
        conversations={[{ id: "conversation-1", title: "Release checklist", project_id: "project-1" }]}
        documents={[]}
        onSelectProject={onSelectProject}
        onCreateProject={vi.fn()}
        onEditProject={vi.fn()}
        onInviteMember={vi.fn()}
        onInviteEmailChange={vi.fn()}
        inviteEmail=""
        onNavigateToWorkspace={vi.fn()}
        onSignOut={onSignOut}
      />,
    );

    expect(screen.getByRole("heading", { name: "Project details" })).toBeInTheDocument();
    expect(screen.getByRole("banner", { name: "Orbital workspace projects" })).toHaveTextContent("Workspace");
    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledOnce();
    expect(screen.getByRole("heading", { name: "Project members" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Invite members to this workspace" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Current working" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Reference files" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Workspace summary")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New project" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Launch plan/i })).toHaveAttribute("aria-current", "page");
    await user.click(screen.getByRole("button", { name: /Website refresh/i }));
    expect(onSelectProject).toHaveBeenCalledWith("project-2");
  });
});
