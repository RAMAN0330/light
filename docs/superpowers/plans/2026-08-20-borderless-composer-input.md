# Borderless Composer Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the visible resting boundary from Orbital's conversation textarea without changing composer behavior.

**Architecture:** Keep the generic `Textarea` component unchanged because it is shared by non-composer forms. Add a composer-local utility override at the existing `Textarea` call site so its border, fill, and shadow cannot reappear through the shared Tailwind field classes. The existing global `:focus-visible` outline remains the keyboard focus indicator.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- Change only the chat composer textarea's visual treatment.
- Preserve placeholder, value, resize, keyboard submission, accessibility name, and focus-visible behavior.
- Do not alter shared field styling or add dependencies.

---

### Task 1: Make the chat composer textarea borderless

**Files:**
- Modify: `client/src/components/ChatApp.test.tsx`
- Modify: `client/src/components/ChatApp.tsx:947-962`

**Interfaces:**
- Consumes: the existing `Textarea` `className` prop, merged with its shared field classes.
- Produces: a chat composer textarea whose resting class list contains `!border-0`, `!bg-transparent`, and `!shadow-none`.

- [x] **Step 1: Write the failing test**

Add a focused assertion to the existing composer render test:

```tsx
const composer = screen.getByRole("textbox", { name: "Message" });
expect(composer).toHaveClass("!border-0", "!bg-transparent", "!shadow-none");
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/components/ChatApp.test.tsx`

Expected: FAIL because the composer textarea does not yet include the borderless utility classes.

- [x] **Step 3: Write minimal implementation**

Pass the local styling override to the existing composer `Textarea`:

```tsx
className="!border-0 !bg-transparent !shadow-none focus:!border-0 focus:!ring-0"
```

- [x] **Step 4: Run test and build to verify the result**

Run: `npm test -- --run src/components/ChatApp.test.tsx && npm run build`

Expected: PASS; TypeScript compilation and Vite production build complete without errors.

- [x] **Step 5: Run the UI detector**

Run:

```bash
node /Users/raman/.codex/plugins/cache/impeccable/impeccable/4.0.4/skills/impeccable/scripts/detect.mjs --json client/src/components/ChatApp.tsx
```

Expected: no new high-severity finding related to the composer edit.
