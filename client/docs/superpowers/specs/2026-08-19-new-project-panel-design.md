# New Project Panel Design

## Goal

Make the New Project panel visually consistent with Workspace Operations while preserving project creation behavior.

## Approved direction

The panel remains a focused modal. It uses a balanced, responsive reading width, a compact teal project marker, a clear title and supporting sentence, two grouped labelled fields, and a restrained footer with Cancel and Create project actions. The modal keeps the existing name and instructions inputs, submission handler, focus behavior, and close behavior.

## Scope

- Update only the New Project form markup and its scoped styles.
- Do not change API calls, project data, validation, or navigation.
- Preserve keyboard and screen-reader labels.
- Keep the panel responsive: a comfortable desktop width and near-full-width presentation on small screens.

## Verification

- The project creation dialog remains discoverable by its existing accessible fields and Create project button.
- Workspace dialog tests pass.
- The production client build succeeds.
