import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GovernanceDialog } from "./GovernanceDialog";
import { OperationsDialog } from "./OperationsDialog";

describe("workspace dialog modules", () => {
  it("shows pending governance work", () => {
    render(<GovernanceDialog open policies={[]} approvalRequests={[{ id: "approval-1", action: "connector.invoke", summary: "Review research source", status: "pending" }]} adapterMessage="" observationTitle="" onClose={vi.fn()} onRegisterAdapter={vi.fn()} onObservationTitleChange={vi.fn()} onCreateObservation={vi.fn()} />);
    expect(screen.getByText("Review research source")).toBeInTheDocument();
  });

  it("forwards task creation", async () => {
    const onCreateTask = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(<OperationsDialog open tasks={[]} notes={[]} notifications={[]} activity={[]} schedules={[]} taskTitle="Ship modular UI" noteTitle="" noteContent="" scheduleTitle="" scheduleCron="0 9 * * 1-5" onClose={vi.fn()} onTaskTitleChange={vi.fn()} onCreateTask={onCreateTask} onTaskStatusChange={vi.fn()} onNoteTitleChange={vi.fn()} onNoteContentChange={vi.fn()} onCreateNote={vi.fn()} onScheduleTitleChange={vi.fn()} onScheduleCronChange={vi.fn()} onCreateSchedule={vi.fn()} onScheduleEnabledChange={vi.fn()}
      ciConnections={[]} pipelineRuns={[]} ciExternalRef="" onCiExternalRefChange={vi.fn()} onCreateCiConnection={vi.fn()}
      ciConnectionId="" onCiConnectionChange={vi.fn()} githubToken="" onGithubTokenChange={vi.fn()} onRegisterCiCredential={vi.fn()}
      workflowRef="" onWorkflowRefChange={vi.fn()} gitRef="main" onGitRefChange={vi.fn()} onTriggerPipeline={vi.fn()} ciTriggerResult={null}
      infraConnections={[]} infraConnectionId="" onInfraConnectionChange={vi.fn()} infraConnectionName="" infraConnectionKind="docker_host" onInfraConnectionNameChange={vi.fn()} onInfraConnectionKindChange={vi.fn()} onCreateInfraConnection={vi.fn()}
      infraResourceType="container" onInfraResourceTypeChange={vi.fn()} infraResult={null} onViewInfraLogs={vi.fn()} onPerformInfraAction={vi.fn()}
    />);
    await userEvent.click(screen.getByRole("button", { name: "Add task" }));
    expect(onCreateTask).toHaveBeenCalledTimes(1);
  });
});
