import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AssistantMessage } from "./AssistantMessage";

describe("AssistantMessage", () => {
  it("renders accidentally indented prose as prose instead of a padded code block", () => {
    const content =
      "    **Takeaway:** Write a one-sentence skill brief.\n\n    **Real-world example:** The OrderLookup skill returns shipment status.";
    render(<AssistantMessage content={content} />);
    expect(screen.getByText(/Write a one-sentence skill brief/)).toBeInTheDocument();
    expect(document.querySelector(".assistant-content pre")).not.toBeInTheDocument();
  });

  it("renders tables with Streamdown's table wrapper", () => {
    const content = "| A | B |\n| --- | --- |\n| 1 | 2 |";
    render(<AssistantMessage content={content} />);
    expect(document.querySelector('[data-streamdown="table-wrapper"] table')).toBeInTheDocument();
  });

  it("renders inline code and fenced code blocks with Streamdown's own components", () => {
    const content = "Use `git status` then:\n\n```ts\nconst x = 1;\n```";
    render(<AssistantMessage content={content} />);
    expect(document.querySelector('[data-streamdown="inline-code"]')).toBeInTheDocument();
    expect(document.querySelector('[data-streamdown="code-block"][data-language="ts"]')).toBeInTheDocument();
  });

  it("shows the streaming cursor only while streaming", () => {
    const { rerender } = render(<AssistantMessage content="Working" isStreaming />);
    expect(document.querySelector(".streaming-cursor")).toBeInTheDocument();
    rerender(<AssistantMessage content="Working" isStreaming={false} />);
    expect(document.querySelector(".streaming-cursor")).not.toBeInTheDocument();
  });
});
