# One Dark Surface Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove remaining legacy light component surfaces from the operational Orbital UI.

**Architecture:** Preserve existing layout declarations and add a final token-based normalization block after legacy styles. Keep chart, visualization, semantic status, and landing-page palettes unchanged. Make the shared `Card` subtle variant use the same One Dark surface and border values as the other variants.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest, Testing Library.

## Global Constraints

- Do not change application behavior, content, or data visualization colors.
- Preserve visible keyboard focus and semantic status distinctions.
- Use existing One Dark design tokens; do not add dependencies.

---

### Task 1: Normalize legacy operational component surfaces

**Files:**
- Create: `client/src/components/ui/card.test.tsx`
- Modify: `client/src/components/ui/card.tsx`
- Modify: `client/src/index.css`

**Interfaces:**
- Consumes: the `Card` component's `variant` prop and existing CSS custom properties.
- Produces: a `subtle` card with One Dark classes, plus token-backed legacy operational surfaces.

- [x] **Step 1: Write the failing shared-card test**

```tsx
import { render } from "@testing-library/react";
import { expect, it } from "vitest";
import { Card } from "./card";

it("renders the subtle card variant with One Dark surface tokens", () => {
  const { getByText } = render(<Card variant="subtle">Content</Card>);
  expect(getByText("Content").parentElement).toHaveClass("bg-[#21252b]", "border-[#3e4451]");
});
```

- [x] **Step 2: Run the new test and verify it fails**

Run: `npm test -- --run src/components/ui/card.test.tsx`

Expected: FAIL because the current subtle variant uses light `#f4f7f6` and `#e5eeec` classes.

- [x] **Step 3: Apply the minimal theme changes**

Change the `subtle` Card variant to `bg-[#21252b] border border-[#3e4451]`. Add a final `index.css` normalization block that maps legacy operational panels, form controls, rows, and dialog surfaces to existing One Dark tokens, without targeting the landing page or data visualization selectors.

- [x] **Step 4: Verify the regression test and client build**

Run: `npm test -- --run src/components/ui/card.test.tsx && npm run build`

Expected: the card test passes and the TypeScript/Vite build completes successfully.

- [x] **Step 5: Run UI verification**

Run:

```bash
node /Users/raman/.codex/plugins/cache/impeccable/impeccable/4.0.4/skills/impeccable/scripts/detect.mjs --json src/components/ui/card.tsx src/index.css
```

Expected: no new detector findings for the changed sources.
