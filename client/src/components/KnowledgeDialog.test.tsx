import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { KnowledgeDialog } from "./KnowledgeDialog";

describe("KnowledgeDialog", () => {
  it("renders sources and forwards a collection search", async () => {
    const onSearch = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <KnowledgeDialog
        open
        artifacts={[{ id: "artifact-1", name: "brief.md", status: "normalized" }]}
        collections={[{ id: "collection-1", name: "Research" }]}
        collectionId="collection-1"
        knowledgeQuery="roadmap"
        citations={[]}
        reportTitle=""
        reportContent=""
        onClose={vi.fn()}
        onUpload={vi.fn()}
        onCollectionChange={vi.fn()}
        onKnowledgeQueryChange={vi.fn()}
        onSearch={onSearch}
        onReportTitleChange={vi.fn()}
        onReportContentChange={vi.fn()}
        onCreateReport={vi.fn()}
      />,
    );

    expect(screen.getByText("brief.md")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(onSearch).toHaveBeenCalledTimes(1);
  });
});
