# Orbital UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Orbital workspace calmer and easier to scan while preserving its teal visual identity and working behavior.

**Architecture:** CSS overrides at the end of `index.css` refine surface hierarchy, navigation rhythm, transcript readability, and composer states. Existing components, labels, and interactions remain unchanged.

**Tech Stack:** React 18, existing CSS, Vitest, Vite.

## Global Constraints

- Keep `#0f766e` as Orbital’s sole accent family.
- Do not add dependencies or change user flows.
- Keep mobile layouts and keyboard-focus treatment accessible.
- Verify using the full client test suite, production build, and Impeccable detector.

---

### Task 1: Refine the operating surface

**Files:**
- Modify: `client/src/index.css`
- Test: `client/src/components/ChatApp.test.tsx`

**Interfaces:**
- Consumes: the existing semantic classes emitted by `ChatApp`.
- Produces: a visually consistent desktop and mobile chat workspace without changed component APIs.

- [x] **Step 1: Preserve existing behavior with the client test suite**

Run: `npm test`

Expected: all current client tests pass before the CSS-only refinement.

- [x] **Step 2: Apply the focused CSS polish**

Add a final scoped override section for the shell, sidebar, transcript, composer, and browser-focus surfaces. Reuse existing classes and teal tokens; do not introduce new markup or dependencies.

- [x] **Step 3: Run client checks**

Run: `npm test && npm run build`

Expected: all tests pass and the production build completes.

- [x] **Step 4: Run visual quality checks**

Run: `node /Users/raman/.codex/plugins/cache/impeccable/impeccable/4.0.4/skills/impeccable/scripts/detect.mjs --json client/src/index.css client/src/components/ChatApp.tsx`

Expected: no mechanical design findings.

- [x] **Step 5: Commit**

This workspace is not a Git repository, so no commit can be made here.
