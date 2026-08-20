import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SkillsDialog } from "./SkillsDialog";

describe("SkillsDialog", () => {
  it("shows provenance and imports upstream processes", async () => {
    const onImportAll = vi.fn();
    render(<SkillsDialog open skills={[{ id: "skill-1", name: "hermes-agent: Research", version: "abc", status: "published", manifest: { tools: ["web.search"], data_access: [], source: "hermes-agent", license: "MIT" }, created_by: "user", created_at: "now" }]} importing={false} onClose={vi.fn()} onImportAll={onImportAll} />);

    expect(screen.getAllByText("hermes-agent", { exact: false }).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole("button", { name: "Import upstream processes" }));
    expect(onImportAll).toHaveBeenCalledTimes(1);
  });
});
