import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VirtualMessageList } from "./VirtualMessageList";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("VirtualMessageList", () => {
  it("mounts only the visible message window for a long transcript", () => {
    render(
      <VirtualMessageList
        items={Array.from({ length: 120 }, (_, id) => id)}
        itemKey={(id) => id}
        renderItem={(id) => <article>Message {id}</article>}
      />,
    );

    expect(screen.getAllByRole("article")).toHaveLength(12);
    expect(screen.queryByText("Message 119")).not.toBeInTheDocument();
  });

  it("follows incoming content while the reader is at the latest message", () => {
    const { rerender } = render(
      <VirtualMessageList items={[0]} itemKey={(id) => id} renderItem={(id) => <article>Message {id}</article>} followLatest />,
    );
    const log = screen.getByRole("log");
    Object.defineProperty(log, "scrollHeight", { configurable: true, value: 1200 });

    rerender(
      <VirtualMessageList items={[0, 1]} itemKey={(id) => id} renderItem={(id) => <article>Message {id}</article>} followLatest />,
    );

    expect(log.scrollTop).toBe(1200);
  });

  it("does not recreate a row observer after recording its height", () => {
    const observe = vi.fn();
    const ResizeObserver = vi.fn(function () {
      return { observe, disconnect: vi.fn() };
    });
    vi.stubGlobal("ResizeObserver", ResizeObserver);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ height: 48 } as DOMRect);

    render(
      <VirtualMessageList items={[0]} itemKey={(id) => id} renderItem={(id) => <article>Message {id}</article>} />,
    );

    expect(ResizeObserver).toHaveBeenCalledTimes(2);
  });
});
