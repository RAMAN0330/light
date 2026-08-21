# Universal Command Composer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Orbital's composer a wide, card-style command surface in every conversation while preserving current message sending and mode selection.

**Architecture:** Keep all behavior within `ChatApp`: add presentational header and quick-action controls to the existing composer form, then replace the component's CSS with responsive layout rules. The quick actions only select existing modes or focus the existing select, so no API contracts change.

**Tech Stack:** React 18, TypeScript, CSS, Vitest, Testing Library, Vite.

## Global Constraints

- Preserve the existing warm off-white, dark green-black, and restrained teal design tokens.
- Keep Enter-to-send and Shift+Enter-to-newline behavior unchanged.
- Keep the existing native response-mode select as the source of truth.
- Support desktop, tablet, and 320 px mobile widths with WCAG 2.2 AA focus and touch targets.
- Do not modify unrelated existing work in `client/src/index.css`.

---

### Task 1: Cover command-composer quick actions

**Files:**
- Modify: `client/src/components/ChatApp.test.tsx`
- Modify: `client/src/components/ChatApp.tsx`

**Interfaces:**
- Consumes: existing `mode: ChatMode`, `setMode`, and `composerRef` within `ChatApp`.
- Produces: quick-action buttons that set `ask` or `research`, or focus the response-mode select.

- [ ] **Step 1: Write the failing test**

```tsx
it("maps command-composer quick actions to the existing modes", async () => {
  const user = userEvent.setup();
  render(<ChatApp accessToken="token" api={api} />);
  await user.click(await screen.findByRole("button", { name: "Conversations" }));

  await user.click(screen.getByRole("button", { name: "Analyze data" }));
  expect(screen.getByRole("combobox", { name: "Response mode" })).toHaveValue("research");

  await user.click(screen.getByRole("button", { name: "Get insights" }));
  expect(screen.getByRole("combobox", { name: "Response mode" })).toHaveValue("ask");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/components/ChatApp.test.tsx -t "maps command-composer quick actions"`

Expected: FAIL because the named buttons do not exist.

- [ ] **Step 3: Add the minimal composer controls**

```tsx
<button type="button" className="composer-quick-action" onClick={() => setMode("research")}>
  <span>Analyze data</span>
</button>
```

Add the semantic header, quick-action container, and a ref to the existing `Select`; map Get insights and Summarize to `ask`, Analyze data to `research`, and More to focusing the select.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --run src/components/ChatApp.test.tsx -t "maps command-composer quick actions"`

Expected: PASS.

### Task 2: Apply the responsive card layout

**Files:**
- Modify: `client/src/index.css`

**Interfaces:**
- Consumes: `.composer`, `.composer-header`, `.composer-footer`, `.composer-quick-actions`, `.composer-quick-action`, and existing form controls.
- Produces: a wide responsive composer with a readable header, two-line prompt area, usable controls, and wrapped quick actions.

- [ ] **Step 1: Add the card and desktop layout styles**

```css
.composer {
  width: min(100% - 48px, 1440px);
  margin: 20px auto 28px;
  padding: clamp(24px, 3vw, 54px);
  border: 2px solid rgba(13, 148, 136, 0.24);
  border-radius: 36px;
}
```

Style the header, textarea, mode control, count, send action, chips, hover state, and focus-visible state using existing teal and neutral tokens.

- [ ] **Step 2: Add narrow-width reflow rules**

```css
@media (max-width: 680px) {
  .composer { width: calc(100% - 24px); padding: 24px; border-radius: 24px; }
  .composer-footer { flex-wrap: wrap; }
  .composer-quick-actions { gap: 8px; }
}
```

Ensure controls preserve 44 px minimum touch targets and long content wraps without clipping.

- [ ] **Step 3: Build to verify types and CSS integration**

Run: `npm run build`

Expected: exit status 0.

### Task 3: Verify the finished surface

**Files:**
- Verify: `client/src/components/ChatApp.tsx`
- Verify: `client/src/components/ChatApp.test.tsx`
- Verify: `client/src/index.css`

- [ ] **Step 1: Run the focused component suite**

Run: `npm test -- --run src/components/ChatApp.test.tsx`

Expected: PASS with no failures.

- [ ] **Step 2: Inspect desktop and narrow layouts**

Run the client locally, inspect the Conversations composer at a wide desktop width and 320 px width, and confirm header hierarchy, keyboard focus, wrapped chips, and no overflow.

- [ ] **Step 3: Run the UI detector**

Run: `node /Users/raman/.codex/plugins/cache/impeccable/impeccable/4.0.4/skills/impeccable/scripts/detect.mjs --json client/src/components/ChatApp.tsx client/src/index.css`

Expected: no unexplained findings.

- [ ] **Step 4: Commit the implementation**

```bash
git add client/src/components/ChatApp.tsx client/src/components/ChatApp.test.tsx client/src/index.css docs/superpowers/plans/2026-08-20-universal-command-composer.md
git commit -m "feat: redesign universal command composer"
```
