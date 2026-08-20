# Orbital Enterprise Workspace Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dashboard-first Orbital workspace with enterprise navigation and a universal lower-left action launcher while preserving every existing workflow.

**Architecture:** Keep `ChatApp` as the API/state coordinator, add focused presentational components for the sidebar, dashboard, and launcher, and reuse existing dialogs and conversation code. Use a small `WorkspaceSurface` state instead of introducing a router or new dependency.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind CSS 4 plus the existing global CSS, Lucide React, Vitest, Testing Library.

## Global Constraints

- Preserve the current warm-neutral and teal theme.
- Do not add dependencies or backend endpoints.
- The default authenticated surface is Overview, not Conversations.
- The lower-left launcher supports Query, Research, Scrape, Analyze, Automate, and Code task modes.
- Keep keyboard access, visible focus, reduced motion, and 320 px responsiveness.

---

### Task 1: Dashboard and navigation behavior

**Files:**
- Create: `client/src/components/WorkspaceDashboard.tsx`
- Create: `client/src/components/WorkspaceSidebar.tsx`
- Modify: `client/src/components/ChatApp.tsx`
- Test: `client/src/components/ChatApp.test.tsx`

**Interfaces:**
- `WorkspaceSidebar` consumes the active surface, workspace/project/conversation counts, and navigation callbacks.
- `WorkspaceDashboard` consumes workspace, task, schedule, notification, activity, project, approval, artifact, and skill data plus action callbacks.
- `ChatApp` produces navigation callbacks and remains responsible for all API calls.

- [ ] **Step 1: Write failing tests for the default Overview and enterprise sidebar labels.**

```tsx
expect(await screen.findByRole("heading", { name: /workspace overview/i })).toBeInTheDocument();
expect(screen.getByRole("button", { name: "Research & scraping" })).toBeInTheDocument();
expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the focused tests and confirm failure because Overview does not exist.**

Run: `npm test -- --run src/components/ChatApp.test.tsx`

- [ ] **Step 3: Implement the minimal surface state, sidebar, and dashboard composition.**

Use `type WorkspaceSurface = "overview" | "conversations"` in `ChatApp`; keep workflow destinations as callbacks to the existing dialogs.

- [ ] **Step 4: Run the focused tests and confirm the dashboard behavior passes.**

Run: `npm test -- --run src/components/ChatApp.test.tsx`

### Task 2: Universal Orbital launcher

**Files:**
- Create: `client/src/components/OrbitalLauncher.tsx`
- Modify: `client/src/components/ChatApp.tsx`
- Test: `client/src/components/ChatApp.test.tsx`

**Interfaces:**
- `OrbitalLauncher` consumes `open`, `mode`, `loading`, `workspaceAvailable`, and callbacks for close, mode change, and submit.
- `ChatApp` provides `submitPrompt(content: string, mode: ChatMode): Promise<void>` and switches to Conversations after submission.

- [ ] **Step 1: Write failing tests for opening the pill, choosing Analyze, and submitting a prompt.**

```tsx
await userEvent.click(screen.getByRole("button", { name: "Ask Orbital" }));
await userEvent.click(screen.getByRole("button", { name: "Analyze" }));
await userEvent.type(screen.getByLabelText("Orbital request"), "Analyze this quarter");
await userEvent.click(screen.getByRole("button", { name: "Start analysis" }));
expect(await screen.findByText("Hi!")).toBeInTheDocument();
```

- [ ] **Step 2: Run the focused test and confirm it fails because the launcher is missing.**

Run: `npm test -- --run src/components/ChatApp.test.tsx`

- [ ] **Step 3: Implement the launcher and extract shared prompt submission from the existing composer.**

Map launcher modes to the current API modes: Query → `ask`; Research/Scrape/Analyze → `research`; Automate/Code task → `create`.

- [ ] **Step 4: Run the focused tests and confirm launcher submission and the existing composer pass.**

Run: `npm test -- --run src/components/ChatApp.test.tsx`

### Task 3: Enterprise workspace styling and responsive layout

**Files:**
- Modify: `client/src/index.css`
- Test: `client/src/components/ChatApp.test.tsx`

**Interfaces:**
- CSS targets semantic classes emitted by `WorkspaceSidebar`, `WorkspaceDashboard`, `OrbitalLauncher`, and the existing conversation surface.

- [ ] **Step 1: Add structural assertions for navigation, main dashboard regions, launcher dialog semantics, and mobile labels.**
- [ ] **Step 2: Run the focused tests and verify missing structure fails.**
- [ ] **Step 3: Add theme-preserving desktop, tablet, mobile, focus, hover, empty, and reduced-motion styles.**
- [ ] **Step 4: Run the full test suite and production build.**

Run: `npm test -- --run && npm run build`

### Task 4: Visual and mechanical verification

**Files:**
- Modify only files with defects found during verification.

- [ ] **Step 1: Run the Impeccable detector once over all changed UI targets.**

Run: `node /Users/raman/.codex/plugins/cache/impeccable/impeccable/4.0.4/skills/impeccable/scripts/detect.mjs --json client/src/components/ChatApp.tsx client/src/components/WorkspaceDashboard.tsx client/src/components/WorkspaceSidebar.tsx client/src/components/OrbitalLauncher.tsx client/src/index.css`

- [ ] **Step 2: Run one desktop and mobile visual inspection, fix defects in one batch, and confirm once.**
- [ ] **Step 3: Re-run the full suite and build and report exact results.**

Run: `npm test -- --run && npm run build`
