# Workspace Details Panel Design

## Goal

Give the workspace picker a focused dark details screen that matches the Projects page while preserving workspace selection and creation.

## Layout

- Retain a persistent left workspace list with the existing compact create control.
- Show the selected workspace in a right-hand detail panel with an Orbital workspace header and a workspace settings action.
- Present a concise details block with created status, access role, project count, and conversation count.
- Stretch the left panel to the right panel height on desktop; stack them on narrow screens.

## Scope

- Reuse the current `Workspace` data and workspace-selection callback; do not add backend fields or endpoints.
- Keep the current empty and search states.
- Do not add a workspace invitation or member-management panel.
- Preserve the established dark Projects-page palette, borders, typography, focus behavior, and responsive breakpoints.
