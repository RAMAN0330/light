# Orbital UI Polish Design

## Goal

Refine the existing Orbital workspace UI into a calmer, more legible operating surface while retaining its teal identity, content, and behavior.

## Scope

- Preserve the existing layout, controls, responsiveness, and all workflow behavior.
- Establish a quieter surface hierarchy: warm neutral shell, clean white work area, teal only for important actions and active states.
- Improve sidebar scanning through more consistent section spacing, selection treatment, and conversation-item affordances.
- Improve long-form chat reading through disciplined message spacing and distinct user/assistant hierarchy.
- Make the composer the clearest focal control with consistent focus, loading, and disabled states.

## Implementation

Consolidate the final CSS overrides in `index.css` rather than introducing another UI library or rewriting component markup. Reuse existing semantic controls and current Lucide icons. Add targeted visual-regression style assertions only where current component tests can make behavior or accessibility regressions observable.

## Constraints

- Keep teal (`#0f766e`) as the only accent family.
- Do not change factual copy or product flows.
- Preserve keyboard focus visibility and mobile layouts.
- Validate with the full client test suite, production build, and Impeccable detector.
