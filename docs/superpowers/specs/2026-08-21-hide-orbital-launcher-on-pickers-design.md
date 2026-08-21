# Hide Orbital launcher on picker pages

## Scope

Remove the floating Orbital launcher from the workspace picker and project-picker/project detail pages. Keep it on workspace application surfaces where it remains a supported entry point.

## Design

Centralize the visibility rule at `ChatApp`, where the launcher is rendered. The launcher will render only outside conversations, workspace selection, and project selection/detail surfaces. No launcher component, styling, or page component changes are needed.

## Verification

Extend the existing `ChatApp` coverage to assert that the launcher is absent on the workspace picker and project picker. Existing launcher behavior on supported surfaces remains covered by the launcher interaction test.
