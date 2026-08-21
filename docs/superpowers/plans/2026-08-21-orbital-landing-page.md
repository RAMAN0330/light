# Orbital Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a modern public landing page for Orbital that leads visitors into the existing authentication flow.

**Architecture:** Render a dedicated `LandingPage` whenever no Supabase session exists. Keep all visual content in a focused React component and its CSS in `index.css`; navigation calls an `onStart` callback that swaps to the existing `AuthScreen`, so authentication behavior remains unchanged.

**Tech Stack:** React 18, TypeScript, Framer Motion, Lucide React, CSS, Vitest, Vite.

## Global Constraints

- Use the app-wide One Dark Pro visual system: charcoal surfaces, slate text, and one blue primary accent.
- Preserve product truth: governed AI work, evidence, approvals, source provenance, and workspace context.
- Do not fabricate customers, metrics, testimonials, pricing, or integrations.
- Provide visible keyboard focus, reduced-motion support, and mobile layouts down to 320 px.

---

### Task 1: Add the public landing route and interaction test

**Files:**
- Create: `client/src/components/LandingPage.tsx`
- Create: `client/src/components/LandingPage.test.tsx`
- Modify: `client/src/App.tsx`

**Interfaces:**
- Produces: `LandingPage({ onStart }: { onStart: () => void })`.
- Consumes: the existing `AuthScreen` and Supabase session state in `App`.

- [ ] **Step 1: Write the failing test**

```tsx
it("opens authentication from the landing page", async () => {
  const user = userEvent.setup();
  const onStart = vi.fn();
  render(<LandingPage onStart={onStart} />);

  await user.click(screen.getByRole("button", { name: "Get started" }));
  expect(onStart).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- --run src/components/LandingPage.test.tsx`

Expected: FAIL because `LandingPage` does not exist.

- [ ] **Step 3: Add the component and route state**

Create the landing page with a concise hero, real product claims, a visual workflow surface, and the primary `Get started` action. Add `showAuth` state to `App`, rendering `AuthScreen` after the visitor chooses a sign-in action.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- --run src/components/LandingPage.test.tsx`

Expected: PASS.

### Task 2: Style the landing page and motion

**Files:**
- Modify: `client/src/index.css`

**Interfaces:**
- Consumes: semantic landing-page class names and One Dark Pro root tokens.
- Produces: an animated responsive public surface without affecting authenticated workspace layouts.

- [ ] **Step 1: Create the landing styles**

Add a full-width dark landing surface, an asymmetric hero with a real product workflow preview, and a three-part capability section. Use CSS transitions plus Framer Motion entrance animations; wrap motion under `prefers-reduced-motion` fallbacks.

- [ ] **Step 2: Verify type and build integration**

Run: `npm run build`

Expected: exit status 0.

### Task 3: Verify behavior and layout

**Files:**
- Verify: `client/src/App.tsx`
- Verify: `client/src/components/LandingPage.tsx`
- Verify: `client/src/components/LandingPage.test.tsx`
- Verify: `client/src/index.css`

- [ ] **Step 1: Run landing and application tests**

Run: `npm test -- --run src/components/LandingPage.test.tsx src/components/AuthScreen.test.tsx`

Expected: PASS with no failures.

- [ ] **Step 2: Build and scan the changed UI**

Run: `npm run build`

Run: `node /Users/raman/.codex/plugins/cache/impeccable/impeccable/4.0.4/skills/impeccable/scripts/detect.mjs --json client/src/App.tsx client/src/components/LandingPage.tsx client/src/index.css`

Expected: build succeeds and the detector has no unexplained findings.
