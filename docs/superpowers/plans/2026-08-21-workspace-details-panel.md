# Workspace Details Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the workspace picker cards with a Projects-style workspace list and selected-workspace detail panel, without invitations.

**Architecture:** `WorkspacesPage` continues to own filtering and selected workspace state through its existing props. It renders the current workspaces on the left and derives the selected workspace for the new right-side details panel. CSS extends the established Projects dark surface rules with workspace-specific classes.

**Tech Stack:** React, TypeScript, Framer Motion, Lucide, Vitest, CSS.

## Global Constraints

- Use existing `Workspace` fields only; do not add backend data or endpoints.
- Preserve `onSelectWorkspace` and `onCreateWorkspace` behavior.
- Do not render workspace invitation or member-management UI.
- Keep the Projects page dark palette and mobile stacking behavior.

---

### Task 1: Render selected workspace details

**Files:**
- Modify: `client/src/components/WorkspacesPage.tsx`
- Test: `client/src/components/WorkspacesPage.test.tsx`

**Interfaces:**
- Consumes: `Workspace[]`, `workspaceId`, `onSelectWorkspace(id)`, `onCreateWorkspace()`.
- Produces: a two-column workspace selector that displays the selected workspace details.

- [ ] **Step 1: Write the failing test**

```tsx
expect(screen.getByRole("heading", { name: "Workspace details" })).toBeInTheDocument();
expect(screen.getByText("Owner access")).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- WorkspacesPage.test.tsx`
Expected: FAIL because the details panel is absent.

- [ ] **Step 3: Write minimal implementation**

```tsx
const selected = workspaces.find((workspace) => workspace.id === workspaceId) || workspaces[0];
```

Render the workspace list in a left `aside` and a selected-workspace `main` panel on the right. Keep the existing search filter and create callback.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npm test -- WorkspacesPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/WorkspacesPage.tsx client/src/components/WorkspacesPage.test.tsx
git commit -m "feat: add workspace details panel"
```

### Task 2: Match the Projects layout and responsive behavior

**Files:**
- Modify: `client/src/index.css`
- Test: `client/src/components/WorkspacesPage.test.tsx`

**Interfaces:**
- Consumes: `workspace-details-layout`, `workspace-list-panel`, and `workspace-detail-panel` markup from Task 1.
- Produces: desktop height matching and a one-column mobile layout.

- [ ] **Step 1: Write the failing test**

```tsx
expect(screen.getByLabelText("Workspace list")).toBeInTheDocument();
expect(screen.getByLabelText("Selected workspace details")).toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- WorkspacesPage.test.tsx`
Expected: FAIL until the semantic regions are rendered.

- [ ] **Step 3: Write minimal implementation**

Add dark workspace-panel styles using the Projects page borders, card surfaces, compact list rows, and an `@media (max-width: 768px)` one-column layout.

- [ ] **Step 4: Run test and production build**

Run: `cd client && npm test -- WorkspacesPage.test.tsx && npm run build`
Expected: PASS and a successful Vite build.

- [ ] **Step 5: Commit**

```bash
git add client/src/index.css client/src/components/WorkspacesPage.test.tsx
git commit -m "style: align workspace page with projects"
```
