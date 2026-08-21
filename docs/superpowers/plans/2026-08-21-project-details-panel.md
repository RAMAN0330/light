# Project Details Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current Projects surface with a persistent left project panel and a dark project-details dashboard that mirrors the approved reference.

**Architecture:** Keep all project data and mutations in `ChatApp`, and make `ProjectsPage` a presentational layout that calls its existing callbacks. The page owns only the temporary selected project id when opened from the picker; styling remains in the existing global stylesheet and uses no new dependencies.

**Tech Stack:** React, TypeScript, Framer Motion, Lucide React, Vitest, CSS.

## Global Constraints

- No API or data-model changes.
- No new dependencies.
- Reuse existing create, edit, open-project, conversation, document, and member callbacks.
- The new-project action is icon-only at rest and exposes the `New project` label on hover and keyboard focus.
- Retain a usable narrow-screen project selector and reduced-motion compatibility.

---

### Task 1: Cover the persistent project panel behavior

**Files:**
- Modify: `client/src/components/ProjectsPage.test.tsx`
- Modify: `client/src/components/ProjectsPage.tsx`

**Interfaces:**
- Consumes: existing `ProjectsPage` props, especially `projects`, `selectedProjectId`, `onSelectProject`, and `onCreateProject`.
- Produces: a project list whose buttons call `onSelectProject(project.id)` and a `New project` button whose accessible name is `New project`.

- [ ] **Step 1: Write the failing test**

Add a rendered two-project fixture and assert the two project names are present, the selected project button has `aria-current="page"`, clicking the other project calls `onSelectProject` with its id, and the new-project trigger is obtainable with `getByRole("button", { name: "New project" })`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- ProjectsPage.test.tsx`

Expected: FAIL because the current screen does not render a project list or expose the selection callback.

- [ ] **Step 3: Write minimal implementation**

In `ProjectsPage.tsx`, restore the passed `onSelectProject` callback, add a left `project-list-panel` with an icon-plus create button and one semantic project button per `projects` item, then call `onSelectProject(id)` when an item is clicked. Set `aria-current="page"` on the selected item and use `aria-label="New project"` on the icon control.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npm test -- ProjectsPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/ProjectsPage.tsx client/src/components/ProjectsPage.test.tsx
git commit -m "feat: add persistent project panel"
```

### Task 2: Build the dark details dashboard and responsive controls

**Files:**
- Modify: `client/src/components/ProjectsPage.tsx`
- Modify: `client/src/index.css`
- Test: `client/src/components/ProjectsPage.test.tsx`

**Interfaces:**
- Consumes: selected `Project`, its conversations, documents, and workspace members from existing page props.
- Produces: `Project details`, `Project members`, and `Current working` sections; `Open project` and `Project settings` retain their existing callbacks.

- [ ] **Step 1: Write the failing test**

Add assertions that the page exposes headings `Project details`, `Project members`, and `Current working`; with no project conversations it renders `Nothing active yet`; and `Open project` calls `onOpenProject`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd client && npm test -- ProjectsPage.test.tsx`

Expected: FAIL because the current card headings and empty-state copy do not match the approved dashboard.

- [ ] **Step 3: Write minimal implementation**

Restructure the selected project content into the approved summary cards. Add created, last-updated, and member-count metadata; retain the existing member, invite, document, and conversation actions within their relevant cards. Use `Clock3`, `CalendarDays`, `FileText`, `Settings2`, and existing icons as needed. Replace the empty conversation state with `Nothing active yet` plus its explanatory copy and existing action buttons.

Update `index.css` to apply the dark elevated surfaces, muted secondary text, blue primary action, panel selection state, and focus/hover expansion for the new-project button. At `768px` or below, keep the list as a horizontal selector and stack details cards; honor `prefers-reduced-motion` by eliminating transition duration.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd client && npm test -- ProjectsPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Run client verification**

Run: `cd client && npm test -- ProjectsPage.test.tsx && npm run build`

Expected: tests pass and Vite completes without TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/components/ProjectsPage.tsx client/src/components/ProjectsPage.test.tsx client/src/index.css
git commit -m "feat: redesign project details surface"
```

