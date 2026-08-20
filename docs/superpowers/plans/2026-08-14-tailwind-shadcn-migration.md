# Tailwind and shadcn-style UI Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the client’s global CSS implementation with Tailwind CSS and small reusable local UI primitives.

**Architecture:** Tailwind v4 compiles through Vite and provides application styling through utilities plus a small theme in `src/index.css`. Local primitives in `src/components/ui` wrap native controls, allowing the existing screens to retain semantic HTML while sharing button, field, and dialog states.

**Tech Stack:** React 18, TypeScript, Vite 6, Tailwind CSS v4, Vitest.

## Global Constraints

- Preserve current APIs, Supabase auth, WebSocket streaming, keyboard actions, and client test behavior.
- Add only Tailwind CSS and its Vite integration; do not add Radix or an icon package.
- Keep native semantic controls and visible keyboard focus.
- Preserve the Orbital light/cobalt design language and mobile workspace access.

---

### Task 1: Configure Tailwind CSS v4

**Files:**
- Modify: `client/package.json`
- Modify: `client/vite.config.ts`
- Modify: `client/src/index.css`

**Interfaces:**
- Produces: Tailwind utility processing for every file imported by the Vite React client.

- [ ] Install `tailwindcss` and `@tailwindcss/vite` as development dependencies.
- [ ] Add the Vite plugin beside `react()`:

```ts
import tailwindcss from "@tailwindcss/vite";

plugins: [react(), tailwindcss()]
```

- [ ] Replace the stylesheet with `@import "tailwindcss";` and root-level Orbital color tokens plus selection, scrollbar, focus, and reduced-motion browser rules.
- [ ] Run `npm run build` and confirm the Tailwind classes compile.

### Task 2: Add local shadcn-compatible primitives

**Files:**
- Create: `client/src/components/ui/button.tsx`
- Create: `client/src/components/ui/field.tsx`
- Create: `client/src/components/ui/dialog.tsx`
- Test: `client/src/components/ChatApp.test.tsx`

**Interfaces:**
- Produces: `Button`, `Input`, `Textarea`, `Select`, and `Dialog` components accepting native element props plus an optional `className`.
- Consumes: Tailwind utility processing from Task 1.

- [ ] Create `Button` with `variant` values `primary`, `secondary`, `ghost`, and `destructive`, forwarding native button props.
- [ ] Create `Input`, `Textarea`, and `Select` that forward native props with shared focus, border, disabled, and surface utilities.
- [ ] Create `Dialog` that renders the existing accessible modal semantics and backdrop styling when `open` is true.
- [ ] Run `npm test -- --run` and confirm the existing chat interactions still pass.

### Task 3: Migrate application screens

**Files:**
- Modify: `client/src/components/ChatApp.tsx`
- Modify: `client/src/components/AuthScreen.tsx`
- Modify: `client/src/components/AssistantMessage.tsx`
- Modify: `client/src/index.css`
- Test: `client/src/components/ChatApp.test.tsx`

**Interfaces:**
- Consumes: local primitives from Task 2.
- Produces: the same user-visible UI and behavior styled solely by Tailwind utilities apart from global browser rules.

- [ ] Replace semantic buttons, fields, selects, textareas, and modal wrappers with primitives where their shared behavior applies.
- [ ] Convert sidebar, header, conversation list, message stream, composer, mobile navigation, and project panels to Tailwind classes.
- [ ] Convert authentication and Markdown response styles to Tailwind classes, including content typography and code blocks.
- [ ] Preserve mobile layout, focus styles, auto-scroll behavior, and streaming `aria-live` state.
- [ ] Run `npm test -- --run` and `npm run build`.

### Task 4: Verify the migrated interface

**Files:**
- Verify: `client/src/index.css`
- Verify: `client/src/components/ChatApp.tsx`
- Verify: `client/src/components/AuthScreen.tsx`

- [ ] Run the Impeccable detector:

```bash
node /Users/raman/.codex/plugins/cache/impeccable/impeccable/4.0.4/skills/impeccable/scripts/detect.mjs --json src/index.css src/components/ChatApp.tsx src/components/AuthScreen.tsx src/components/AssistantMessage.tsx
```

- [ ] Fix any actionable findings, then run `npm test -- --run && npm run build` again.
