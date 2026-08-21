# Hide Orbital Launcher on Picker Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the floating Orbital launcher from workspace and project picker/detail pages while preserving it on supported workspace surfaces.

**Architecture:** `ChatApp` owns the single launcher instance and knows the active `surface`, so it is the only production file that needs to change. A focused integration test in the existing `ChatApp` suite protects the intended picker-page visibility rule.

**Tech Stack:** React, TypeScript, Vitest, Testing Library.

## Global Constraints

- Do not modify `OrbitalLauncher`, page components, or launcher CSS.
- Keep the launcher available on non-picker, non-conversation workspace surfaces.
- Preserve all unrelated dirty worktree changes.

---

### Task 1: Gate launcher visibility by active surface

**Files:**
- Modify: `client/src/components/ChatApp.test.tsx`
- Modify: `client/src/components/ChatApp.tsx:1637-1647`

**Interfaces:**
- Consumes: `surface`, the existing `WorkspaceSurface` state in `ChatApp`.
- Produces: No `Ask Orbital` launcher button when `surface` is `workspaces`, `project-picker`, or `projects`.

- [ ] **Step 1: Write the failing test**

Add this assertion to the existing workspace-picker test:

```tsx
expect(screen.queryByRole("button", { name: "Ask Orbital" })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run from `client/`: `npm test -- --run src/components/ChatApp.test.tsx`

Expected: FAIL because the launcher is currently rendered on the workspace picker.

- [ ] **Step 3: Write minimal implementation**

Replace the launcher condition with a picker-aware guard:

```tsx
{!['conversations', 'workspaces', 'project-picker', 'projects'].includes(surface) && (
  <OrbitalLauncher
    open={launcherOpen}
    mode={launcherMode}
    loading={loading}
    onOpen={() => openLauncher("query")}
    onClose={() => setLauncherOpen(false)}
    onModeChange={setLauncherMode}
    onSubmit={(prompt, selectedMode) => submitPrompt(prompt, launcherChatMode(selectedMode))}
  />
)}
```

- [ ] **Step 4: Run test to verify it passes**

Run from `client/`: `npm test -- --run src/components/ChatApp.test.tsx`

Expected: PASS, including the existing launcher interaction test.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/ChatApp.tsx client/src/components/ChatApp.test.tsx docs/superpowers/plans/2026-08-21-hide-orbital-launcher-on-pickers.md
git commit -m "fix: hide launcher on workspace and project pages"
```
