# Remove Project KPIs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the KPI summary strip from the project page.

**Architecture:** `ProjectsPage` owns the summary markup and its existing component test covers its accessibility landmark. Delete both the markup and expectation without changing layout, project data, or styles used by other surfaces.

**Tech Stack:** React, TypeScript, Vitest, Testing Library.

## Global Constraints

- Preserve all project details, member controls, files, and navigation.
- Do not delete shared CSS outside the KPI markup.
- Preserve unrelated dirty worktree changes.

---

### Task 1: Remove the project KPI strip

**Files:**
- Modify: `client/src/components/ProjectsPage.test.tsx`
- Modify: `client/src/components/ProjectsPage.tsx:50-55`

**Interfaces:**
- Consumes: The page's current project, conversation, artifact, and member data.
- Produces: A project page without the `Workspace summary` landmark.

- [ ] **Step 1: Write the failing test**

Replace the four summary-content assertions with:

```tsx
expect(screen.queryByLabelText("Workspace summary")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run test to verify it fails**

Run from `client/`: `npm test -- --run src/components/ProjectsPage.test.tsx`

Expected: FAIL because the `Workspace summary` landmark is still rendered.

- [ ] **Step 3: Write minimal implementation**

Delete this block from `ProjectsPage`:

```tsx
<div className="projects-stat-grid" aria-label="Workspace summary">
  <div className="projects-stat-card"><FolderKanban size={17} /><span><small>Total projects</small><strong>{projects.length}</strong></span></div>
  <div className="projects-stat-card"><MessageSquarePlus size={17} /><span><small>Total conversations</small><strong>{conversations.length}</strong></span></div>
  <div className="projects-stat-card"><FileText size={17} /><span><small>Reference files</small><strong>{artifacts.length}</strong></span></div>
  <div className="projects-stat-card"><Users size={17} /><span><small>Active members</small><strong>{members.length}</strong></span></div>
</div>
```

- [ ] **Step 4: Run test and build to verify the change**

Run from `client/`:

```bash
npm test -- --run src/components/ProjectsPage.test.tsx
npm run build
```

Expected: the page test and TypeScript/Vite build both pass.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/ProjectsPage.tsx client/src/components/ProjectsPage.test.tsx docs/superpowers/plans/2026-08-21-remove-project-kpis.md
git commit -m "fix: remove project KPI summary"
```
