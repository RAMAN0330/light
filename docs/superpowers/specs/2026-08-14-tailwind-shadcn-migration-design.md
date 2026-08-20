# Tailwind and shadcn-style UI Migration

## Goal

Move the React client from a monolithic global stylesheet to Tailwind CSS and a small, local shadcn-compatible component layer without changing authentication, data APIs, WebSocket streaming, or existing user flows.

## Design

Tailwind CSS v4 will own layout, responsive rules, colors, spacing, typography, and interaction states. `src/index.css` will keep only Tailwind imports and the global browser-surface rules that belong at the application boundary.

The app will include local primitives in `src/components/ui/`: `Button`, `Input`, `Textarea`, `Select`, and `Dialog`. They will expose ordinary React props and `className`, so application screens retain exact visual control. No generated shadcn registry and no Radix dependency are required for the current chat interface; native controls cover the existing accessible behavior.

`ChatApp`, `AuthScreen`, and `AssistantMessage` will be converted to Tailwind utilities and the local primitives. The current light cobalt Orbital language, compact sidebar, responsive workspace picker, keyboard message submission, dialogs, Markdown output, and reduced-motion behavior will remain intact.

## Constraints

- Preserve all existing client tests and behavior.
- Keep the client dependency set minimal: Tailwind and its Vite integration only; do not add an icon or component library for controls already represented by native HTML.
- Retain visible keyboard focus, semantic labels, disabled states, and responsive behavior.
- Keep the existing FastAPI/Supabase/WebSocket backend unchanged.

## Verification

- Run the existing Vitest suite.
- Run the production Vite build.
- Run the Impeccable detector against the migrated UI files.
