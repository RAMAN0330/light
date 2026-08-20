# Chat Message Virtualization Design

## Goal

Keep long Orbital conversations responsive by mounting only the messages near the visible portion of the chat transcript.

## Scope

- Replace the unbounded `messages.map(...)` rendering in `ChatApp` with a small local virtual list.
- Preserve message order, semantic message articles, copying, streamed assistant output, and automatic scroll-to-latest behavior.
- Support variable-height Markdown and user messages by measuring rendered rows with `ResizeObserver`.
- Keep a generous overscan buffer so normal scrolling does not show blank gaps.

## Approach

Create a focused `VirtualMessageList` component. It owns scroll position, measured heights, and top/bottom spacer elements; `ChatApp` continues to own data loading, streaming, actions, and message rendering. The component renders only the computed visible range, using a conservative estimated height until each message is measured.

When a user is already near the bottom, new or streaming content keeps the transcript pinned to the latest message. When they scroll up to read history, incoming content does not pull them away.

## Constraints

- No new dependency: the client has no installed virtualization library, and a local implementation is smaller for this one list.
- Preserve the current teal Orbital UI and accessibility semantics.
- Validate with a component test using a long conversation, plus the existing client test suite and production build.
