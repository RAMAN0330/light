# Orbital Enterprise Workspace Redesign

## Goal

Reframe Orbital from a chatbot shell into a dashboard-first enterprise workspace for governed automation, scraping, research, analysis, code intelligence, knowledge, and operational work while preserving the existing warm-neutral and teal theme.

## Experience architecture

- The authenticated default is **Overview**, a real workspace command center with work status, attention items, active capabilities, recent activity, projects, and shortcuts into existing workflows.
- The sidebar is organized by user intent: **Workspace** (Overview, Runs, Projects), **Intelligence** (Research & scraping, Analysis, Knowledge, Codebases), and **Manage** (Automations, Skills & connectors, Approvals & governance).
- **Conversations** remains available as a destination for transcripts and long-running follow-up work, but does not define the shell.
- A fixed **Ask Orbital** pill lives in the lower-left corner. It opens a compact action launcher with Query, Research, Scrape, Analyze, Automate, and Code task modes. Submitting creates or reuses a conversation, starts the run through the existing chat API, closes the launcher, and opens the conversation view.

## Dashboard composition

The dashboard behaves like an operational control room rather than a grid of equal cards:

1. A restrained header identifies the active workspace, current date, global search, and workspace health.
2. A wide work queue shows current runs and scheduled work with explicit states.
3. A narrower attention rail surfaces approvals, failed or blocked work, and unread notifications.
4. A capability strip exposes the primary work Orbital can perform with direct, specific copy.
5. Recent activity and projects use compact lists with timestamps and owners rather than decorative cards.

All displayed counts come from loaded workspace data when available. Empty states describe the first permitted action instead of inventing enterprise metrics.

## Interaction model

- Sidebar navigation changes the primary content surface or opens an existing full workflow without losing workspace context.
- The launcher is keyboard accessible, closes with Escape, returns focus to its trigger, and supports a visible mode selection.
- Selecting a dashboard capability opens the launcher in the matching mode.
- Existing dialogs remain available for complex workflows during this iteration, but their entry points become first-class navigation items rather than hidden text links.
- Conversation history, sending, cancellation, streaming, export, project context, and draft persistence continue to use current contracts.

## Responsive behavior

- Desktop uses a persistent 248–272 px navigation rail and one broad content canvas.
- Tablet collapses secondary dashboard columns while keeping the workspace and action launcher visible.
- Mobile replaces the rail with a compact top bar and horizontal module navigation; the launcher becomes a full-width bottom sheet above its pill.

## Visual direction

- Preserve the current warm off-white background, white working surface, dark green text, and restrained teal accent.
- Use strong typographic scale, thin structural rules, dense operational lists, and asymmetric dashboard columns.
- Avoid AI gradients, decorative glass, nested cards, generic metric-card rows, and chatbot-centric empty states.
- Motion is limited to the launcher expansion and subtle state transitions, with reduced-motion support.

## Error and empty states

- Workspace API failures remain visible in the existing alert region.
- Missing workspace data renders honest zero or empty states and a relevant action.
- Launcher submission errors preserve the prompt and show the existing recoverable error message.
- Disabled actions clearly state their unavailable workspace dependency.

## Testing

- Verify Overview is the default surface and exposes enterprise capability language.
- Verify sidebar navigation opens Conversations and existing governed workflows.
- Verify the lower-left launcher opens, changes work type, submits through the chat API, and lands in Conversations.
- Preserve existing streaming, cancellation, projects, dialogs, accessibility roles, and responsive behavior.

## Scope boundaries

- No new backend endpoints, fake analytics, router dependency, or design-system migration.
- No theme replacement.
- No claim that an unavailable connector or adapter is active.
- The change restructures the existing React workspace and reuses installed dependencies.
