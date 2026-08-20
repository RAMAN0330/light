import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { WorkspaceDashboard } from "./WorkspaceDashboard";

const dashboardProps = {
  tasks: [],
  schedules: [],
  notifications: [],
  activity: [],
  approvals: [],
  artifacts: [],
  skills: [],
  projects: [],
  onLauncher: vi.fn(),
  onOperations: vi.fn(),
  onKnowledge: vi.fn(),
  onGovernance: vi.fn(),
  onProjectCreate: vi.fn(),
};

describe("WorkspaceDashboard", () => {
  it("announces each KPI label before its value", () => {
    render(<WorkspaceDashboard {...dashboardProps} />);

    const summary = screen.getByLabelText("Workspace summary");
    expect(summary.textContent).toMatch(/Active tasks\s*0/);
    expect(summary.textContent).toMatch(/Enabled schedules\s*0/);
    expect(summary.textContent).toMatch(/Knowledge artifacts\s*0/);
    expect(summary.textContent).toMatch(/Published skills\s*0/);
  });
});
