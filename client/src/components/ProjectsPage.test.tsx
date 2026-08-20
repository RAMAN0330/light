import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProjectsPage } from "./ProjectsPage";

describe("ProjectsPage", () => {
  it("shows the selected project context and project-scoped work", () => {
    render(
      <ProjectsPage
        projects={[{ id: "project-1", name: "Launch plan", instructions: "Ship the next release." }]}
        selectedProjectId="project-1"
        conversations={[{ id: "conversation-1", title: "Release checklist", project_id: "project-1" }]}
        documents={[]}
        onSelectProject={vi.fn()}
        onCreateProject={vi.fn()}
        onNewConversation={vi.fn()}
        onEditProject={vi.fn()}
        onInviteMember={vi.fn()}
        onInviteEmailChange={vi.fn()}
        inviteEmail=""
        onUploadDocument={vi.fn()}
        onDeleteDocument={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Launch plan" })).toBeInTheDocument();
    expect(screen.getByText("Release checklist")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Reference files" })).toBeInTheDocument();
  });
});
