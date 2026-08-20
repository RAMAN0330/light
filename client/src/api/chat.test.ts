import { afterEach, describe, expect, it, vi } from "vitest";
import { chatApi, extractSseEvents } from "./chat";

afterEach(() => vi.restoreAllMocks());

describe("extractSseEvents", () => {
  it("returns structured events and keeps an incomplete event buffered", () => {
    expect(extractSseEvents('data: {"text":"Hi"}\n\ndata: {"text":"the')).toEqual({
      events: [{ type: "delta", text: "Hi" }],
      remaining: 'data: {"text":"the',
    });
  });
});

describe("chatApi.sendMessage", () => {
  it("uses an authenticated POST request and yields SSE delta events", async () => {
    const encoder = new TextEncoder();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('data: {"type":"run","run_id":"run-1"}\n\ndata: {"type":"delta","text":"Hello"}\n\ndata: {"type":"done"}\n\n'));
            controller.close();
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      ),
    );
    const onRunStarted = vi.fn();

    const reply = [];
    for await (const chunk of chatApi.sendMessage("token", "chat-1", "Hi", "ask", onRunStarted)) reply.push(chunk);

    expect(reply).toEqual(["Hello"]);
    expect(onRunStarted).toHaveBeenCalledWith("run-1");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/chat",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: "chat-1", content: "Hi", mode: "ask" }),
      }),
    );
  });
});
