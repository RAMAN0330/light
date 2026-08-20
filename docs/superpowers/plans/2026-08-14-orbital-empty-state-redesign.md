# Orbital Empty-State Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a distinctive centered Orbital default workspace with useful prompt starters and an orbit-dock composer.

**Architecture:** `ChatApp` owns a static list of prompt-starter strings and fills the existing controlled composer when one is chosen. Existing empty-state and composer selectors in `index.css` gain scoped Orbit-dock styles, leaving non-empty conversations on their existing layout.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v4, existing local UI primitives, Vitest.

## Global Constraints

- Preserve all WebSocket, Supabase, mode, keyboard, and mobile behavior.
- Suggestion clicks populate text only; they must not send a message.
- Do not add dependencies.

---

### Task 1: Build the centered Orbital command surface

**Files:**
- Modify: `client/src/components/ChatApp.tsx`
- Modify: `client/src/index.css`
- Test: `client/src/components/ChatApp.test.tsx`

**Interfaces:**
- Produces: a default-stage with three prompt-starter buttons and an existing composer populated through `setText`.

- [ ] Add three concise prompt starters and render them only while no messages exist.
- [ ] On a prompt-starter click, call `setText(starter)` and focus `composerRef`; do not call `send`.
- [ ] Update the default-stage styles to use a centered orbit mark, compact prompts, and focused dock with reduced-motion-safe transitions.
- [ ] Run `npm test -- --run` and confirm the existing chat behavior passes.

### Task 2: Verify the redesign

**Files:**
- Verify: `client/src/components/ChatApp.tsx`
- Verify: `client/src/index.css`

- [ ] Run `npm run build`.
- [ ] Run the Impeccable detector against the changed UI files and resolve actionable findings.
