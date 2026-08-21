# One Dark Surface Normalization Design

## Goal

Make all operational Orbital UI components use the established One Dark Pro surface, border, and text tokens. Remove only legacy light visual treatments that conflict with the active theme.

## Scope

- Normalize legacy app surfaces in `client/src/index.css` that currently use white or near-white backgrounds.
- Update the shared `Card` component's light `subtle` variant to use the same dark surface and border tokens as the rest of the system.
- Preserve semantic status colors, visualizations, contrast, keyboard focus, and existing interactions.

## Non-goals

- Do not recolor data visualizations, charts, or syntax-oriented developer tooling.
- Do not redesign the landing page, change content, or modify application behavior.
- Do not rewrite in-progress feature components with unrelated hard-coded visual systems.

## Implementation

Add a final CSS normalization block after legacy declarations so it wins the cascade without disturbing layout rules. It will target the affected app panels, forms, list rows, and dialogs and map them to `--surface-card`, `--surface-subtle`, `--surface-hover`, `--border-subtle`, and `--text-*` tokens. The shared `Card` `subtle` variant will move from fixed light hex values to matching dark Tailwind utilities.

## Verification

Run focused component tests and the client production build. Use the UI detector on every modified UI source and visually inspect representative component surfaces at desktop and mobile widths.
