# Chat Message Virtualization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep long chat transcripts responsive by rendering only messages near the viewport.

**Architecture:** A local `VirtualMessageList` owns scroll state, measured row heights, a fixed overscan range, and spacer elements. `ChatApp` retains message data, rendering callbacks, and all message actions. The virtual list pins to the latest content only when the reader is already near the bottom.

**Tech Stack:** React 18, TypeScript, `ResizeObserver`, Vitest, Testing Library.

## Global Constraints

- Do not add a package; this is a single list and the existing client has no virtualizer dependency.
- Preserve message `<article>` semantics, streamed Markdown, copy controls, and current teal styling.
- Use estimated heights until the real `ResizeObserver` measurement arrives.
- Run the focused test, full client test suite, and production build.

---

### Task 1: Virtual message list

**Files:**
- Create: `client/src/components/VirtualMessageList.tsx`
- Create: `client/src/components/VirtualMessageList.test.tsx`
- Modify: `client/src/components/ChatApp.tsx`

**Interfaces:**
- Consumes: `items: readonly T[]`, `renderItem(item, index): ReactNode`, `itemKey(item, index): Key`, `followLatest: boolean`.
- Produces: `VirtualMessageList`, which renders a scrollable `role="log"` container with only visible message rows mounted.

- [x] **Step 1: Write the failing test**

```tsx
it("mounts only the visible message window for a long transcript", () => {
  render(<VirtualMessageList items={Array.from({ length: 120 }, (_, id) => id)} itemKey={(id) => id} renderItem={(id) => <article>Message {id}</article>} />);
  expect(screen.getAllByRole("article")).toHaveLength(12);
  expect(screen.queryByText("Message 119")).not.toBeInTheDocument();
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- VirtualMessageList.test.tsx`

Expected: FAIL because the component does not exist.

- [x] **Step 3: Write minimal implementation**

```tsx
export function VirtualMessageList<T>({ items, renderItem, itemKey, followLatest = false }: Props<T>) {
  // Use a 120px estimate, measured row heights, 600px overscan, and top/bottom spacers.
}
```

- [x] **Step 4: Integrate it in ChatApp**

Replace the non-empty `messages.map(...)` branch with `VirtualMessageList`. Pass the existing article rendering as `renderItem`, stable message keys, and `followLatest={loading}`.

- [x] **Step 5: Run focused test to verify it passes**

Run: `npm test -- VirtualMessageList.test.tsx`

Expected: PASS.

- [x] **Step 6: Run client checks**

Run: `npm test && npm run build`

Expected: all tests pass and the Vite production build completes.

- [x] **Step 7: Commit**

This workspace is not a Git repository, so no commit can be made here.
