# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Orbital serves enterprise knowledge workers, builders, workspace administrators, and security or audit teams working inside a shared organizational workspace.

## Product Purpose

Orbital is a secure enterprise workspace for completing governed knowledge and operational work. It combines automation, web and source scraping, analysis, research, codebase intelligence, document workflows, scheduled work, and conversational assistance in one auditable environment.

Success means users can see the state of their workspace, start or inspect work, and recover its evidence without treating Orbital as a chatbot-only product.

## Positioning

Orbital makes AI work governable: every run, tool action, source, approval, artifact, connector invocation, and cost can be attributed to a workspace, actor, and policy decision.

## Operating Context

- The default authenticated surface is a workspace dashboard, not a conversation.
- Users launch and monitor automations, scraping and research runs, analyses, codebase tasks, projects, schedules, knowledge, and approvals from the workspace.
- A floating control in the lower-left corner opens a compact universal action launcher for questions, research, automation creation, scraping, file analysis, and codebase tasks.
- Chat remains available as one workflow and as a follow-up interface for runs; it is not the product shell.

## Capabilities and Constraints

- Preserve the existing React, TypeScript, Vite, Tailwind, and Supabase stack.
- Preserve the current warm-neutral and teal theme while fully revising layout, hierarchy, navigation, and interaction design.
- All visible data and actions remain organization and workspace scoped.
- Protected actions must expose approval, policy, provenance, and audit state.
- The interface must support desktop, tablet, and mobile use and meet WCAG 2.2 AA requirements.

## Brand Commitments

- Product name: Orbital.
- Preserve the existing warm off-white surfaces, dark green-black text, and restrained teal accent.
- Voice is calm, precise, operational, and specific; avoid chatbot-first language and inflated AI claims.

## Evidence on Hand

- Product requirements: `docs/orbital/01-prd.md`
- Frontend requirements: `docs/orbital/04-frontend-specification.md`
- Feature plan: `docs/orbital/03-feature-tickets.md`
- Delivery roadmap: `docs/orbital/06-delivery-roadmap.md`
- Existing APIs and UI flows cover conversations, workspaces, projects, tasks, notes, notifications, schedules, knowledge, research reports, skills, adapters, approvals, and policies.
- No customer logos, testimonials, or externally validated performance claims are available and none should be fabricated.

## Product Principles

1. Lead with workspace state and work in motion, not an empty prompt.
2. Make powerful actions discoverable while keeping their policy and approval consequences visible.
3. Keep evidence, sources, artifacts, and run history attached to the work that produced them.
4. Let users move from overview to action without modal-heavy navigation.
5. Use conversation where it improves a workflow, not as the container for every workflow.

## Accessibility & Inclusion

Meet WCAG 2.2 AA with complete keyboard access, visible focus, sufficient contrast, non-color status indicators, reduced-motion support, responsive layouts down to 320 px, and equivalent list views for visual graphs.
