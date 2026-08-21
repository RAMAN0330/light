import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { WorkspaceBreadcrumb } from "./workspace-breadcrumb";

it("returns to the workspace overview when Workspace is selected", async () => {
  const onNavigateToWorkspace = vi.fn();
  const user = userEvent.setup();

  render(<WorkspaceBreadcrumb current="Projects" onNavigateToWorkspace={onNavigateToWorkspace} />);
  await user.click(screen.getByRole("button", { name: "Workspace" }));

  expect(onNavigateToWorkspace).toHaveBeenCalledOnce();
  expect(screen.getByText("Projects")).toHaveAttribute("aria-current", "page");
});
