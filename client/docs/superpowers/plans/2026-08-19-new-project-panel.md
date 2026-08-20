# New Project Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the New Project panel to match the calm, balanced Workspace Operations modal.

**Architecture:** Keep `ChatApp` as the owner of project form state and submission. Add a scoped class and semantic field wrappers to the existing New Project form, then apply modal-only CSS in `index.css` so other workspace dialogs retain their existing visual treatment.

**Tech Stack:** React, TypeScript, CSS, Vitest, Vite.

## Global Constraints

- Preserve `createProject`, `setProjectForm(false)`, and the existing Project name and Project instructions accessible labels.
- Do not add dependencies or change project API behavior.
- The panel must be responsive and remain within the viewport.

---

### Task 1: Refine New Project panel structure and styles

**Files:**
- Modify: `src/components/ChatApp.tsx:1284-1316`
- Modify: `src/index.css:2512-2788`
- Test: `src/components/WorkspaceDialogs.test.tsx`

**Interfaces:**
- Consumes: `projectForm`, `projectName`, `projectInstructions`, `createProject`, and `setProjectForm` from `ChatApp` state.
- Produces: A New Project dialog with unchanged control labels and submit behavior.

- [ ] **Step 1: Confirm the current dialog test baseline**

Run: `npm test -- WorkspaceDialogs.test.tsx`

Expected: PASS.

- [ ] **Step 2: Apply the scoped panel structure**

Add `project-create-dialog` to the existing New Project form, add a teal folder marker and a close button that calls `setProjectForm(false)`, and group the two existing controls in labelled field wrappers. Keep the current `aria-label`, state bindings, and `onSubmit={createProject}`.

- [ ] **Step 3: Apply scoped responsive styles**

Add `.project-create-dialog` CSS that uses a desktop cap of `640px`, gentle teal-tinted header treatment, 16px field radii, a two-action footer, and a `max-width: 680px` override that uses the available viewport width.

- [ ] **Step 4: Verify modal behavior and build**

Run: `npm test -- WorkspaceDialogs.test.tsx && npm run build`

Expected: PASS.
