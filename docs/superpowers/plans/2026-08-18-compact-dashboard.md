# Compact Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the workspace dashboard more compact and render its four summary metrics as clear two-row KPI cards.

**Architecture:** Keep the dashboard's existing data calculations and actions. Update semantic KPI markup so the label is announced before its value, then use the existing dashboard stylesheet to establish a short, consistent KPI card and reduce empty-state or fixed-panel heights across the overview.

**Tech Stack:** React 18, TypeScript, Vitest, Testing Library, CSS.

## Global Constraints

- Preserve the warm-neutral and teal Orbital visual language.
- Preserve all existing data, labels, click handlers, and keyboard behavior outside the removed Design System navigation entry.
- Labels must render above values in every KPI card.
- Keep the overview usable at desktop, tablet, and mobile widths.

---

### Task 1: Assert the KPI hierarchy and remove the Design System navigation item

**Files:**
- Modify: `client/src/components/WorkspaceDashboard.tsx`
- Modify: `client/src/components/WorkspaceSidebar.tsx`
- Create: `client/src/components/WorkspaceDashboard.test.tsx`

**Interfaces:**
- Consumes: `WorkspaceDashboard` props as currently declared.
- Produces: a dashboard summary whose accessible text order is label then value, plus a sidebar without a Design System entry.

- [ ] **Step 1: Write the failing test**

```tsx
it("renders each KPI label before its value", () => {
  render(<WorkspaceDashboard {...dashboardProps} />);
  const summary = screen.getByLabelText("Workspace summary");
  expect(summary.textContent).toMatch(/Tasks\s*0/);
  expect(summary.textContent).toMatch(/Schedules\s*0/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- WorkspaceDashboard.test.tsx`

Expected: FAIL because the current card text is ordered icon/category/value/description instead of the required label/value hierarchy.

- [ ] **Step 3: Write minimal implementation**

```tsx
<div className="kpi-card">
  <div className="kpi-card-label"><span>{icon}</span><span>Tasks</span></div>
  <div className="kpi-card-value"><strong>{openTasks.length}</strong><Sparkline ... /></div>
</div>
```

Remove the optional Design System section and its `Palette` import from `WorkspaceSidebar.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- WorkspaceDashboard.test.tsx`

Expected: PASS.

### Task 2: Compact the dashboard layout

**Files:**
- Modify: `client/src/index.css:597-1085`

**Interfaces:**
- Consumes: the KPI class names from Task 1 and existing dashboard section markup.
- Produces: short two-row KPI cards and reduced-height overview sections without clipping their content.

- [ ] **Step 1: Add a failing layout assertion**

```tsx
it("keeps KPI cards in the compact summary grid", () => {
  render(<WorkspaceDashboard {...dashboardProps} />);
  expect(screen.getByLabelText("Workspace summary").querySelectorAll(".kpi-card")).toHaveLength(4);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- WorkspaceDashboard.test.tsx`

Expected: FAIL until the dashboard fixture and summary markup are in place.

- [ ] **Step 3: Write minimal implementation**

Set KPI cards to a 76px minimum height with label/icon on the first row and the large value plus compact sparkline on the second. Set the work queue empty state to a bounded 190px height, give Needs attention a compact content height, and use a bounded 160px context split and 260px Start work tile area. Add a single responsive breakpoint that allows the overview to scroll rather than clip on narrower layouts.

- [ ] **Step 4: Run test and production build**

Run: `npm test -- WorkspaceDashboard.test.tsx && npm run build`

Expected: PASS and a clean TypeScript/Vite build.

- [ ] **Step 5: Verify visual layout and detector**

Run: `node /Users/raman/.codex/plugins/cache/impeccable/impeccable/4.0.4/skills/impeccable/scripts/detect.mjs --json client/src/components/WorkspaceDashboard.tsx client/src/components/WorkspaceSidebar.tsx client/src/index.css`

Expected: no unexplained detector findings.
