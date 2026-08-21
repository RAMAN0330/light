# Project details panel design

## Goal

Make the Projects surface a focused dark project workspace that matches the provided reference, with quick project switching in a permanent left-side panel.

## Layout

- Keep the application workspace navigation intact.
- Within the Projects surface, render a two-column layout on desktop: a left project panel and a main details area.
- The left panel contains a `Projects` heading, a compact new-project icon button, and the current workspace's project list. The currently selected project is visually distinct.
- The new-project control displays only a plus icon at rest. On hover and keyboard focus, it expands to reveal the `New project` label without shifting the project list.
- Selecting a project updates the details area in place and preserves the existing create, edit, and open-project actions.

## Project details area

- Use a dark, low-contrast layered surface with subtle borders to align with the supplied reference and the app's current dark workspace style.
- The top row has `Project details` and `Current working` cards.
- Project details displays created time, last updated time, and member count. A project-members section below preserves managing and inviting members.
- Current working shows the most recent conversation when available; otherwise it uses the supplied empty-state treatment and exposes `Open project` and `Project settings` actions.
- Existing documents and conversations remain reachable in the project details area, but are visually secondary to the new summary cards.

## Responsive and accessible behavior

- At narrow widths, stack the details cards and transform the project panel into a horizontally scrollable project selector.
- The selected item and all icon-only controls have visible labels for assistive technology.
- Hover-only behavior is mirrored by `:focus-visible`, and reduced-motion preferences disable nonessential transitions.

## Testing

- Update the Projects page component test to assert a visible project list, selection behavior, and the accessible name of the new-project control.
- Run the targeted test and the client type/build checks.

## Scope boundaries

- No API or data-model changes.
- No new dependencies.
- Project management dialogs and member invitation flows remain the existing implementations.
