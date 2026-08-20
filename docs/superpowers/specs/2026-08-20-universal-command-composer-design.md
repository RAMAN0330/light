# Universal command composer design

## Goal

Replace Orbital's compact chat composer with one wide, card-style command composer in both new and existing conversations. The composer should match the supplied reference: calm, spacious, clearly actionable, and visibly part of Orbital's warm off-white and teal visual system.

## Structure

On desktop and tablet, the composer is a centered, full-width panel within the conversation content column, capped at approximately 1,440 px. It contains:

1. A header with the Orbital spark mark, the heading "How can Orbital help you today?", and supporting copy.
2. A multi-line message field with a subtle divider before the controls.
3. A control row containing the existing response-mode select, live character counter, and primary send action.
4. Quick-action chips for Get insights, Analyze data, Summarize, and More. Get insights and Summarize select Ask Orbital; Analyze data selects Research; More moves focus to the existing response-mode select. Existing response modes remain the source of truth, so the chips add no new back-end behavior.

The same component appears below every conversation. It retains its placement in the task path: read the thread, compose the next instruction, send it. It does not overlap message history.

## Visual and interaction rules

- The panel has a white-to-soft-neutral surface, 2 px pale-teal border, large rounded corners, and a restrained soft shadow.
- Heading text is dark green-black, support text is muted blue-green, and teal is reserved for the Orbital mark, mode treatment, and send action.
- The textarea initially provides a comfortable two-line writing area, grows to its existing maximum height, and preserves keyboard behavior: Enter sends and modified Enter adds a line break.
- The send control remains disabled for an empty prompt or while a request is in flight, with accessible labels and a visible focus treatment.
- Mode selection remains a native accessible select. The character count is readable but secondary.
- Quick-action chips are buttons with concise labels and icons. They support pointer and keyboard use, and have hover, focus, and active affordances.

## Responsive behavior

- At wide widths, the header, controls, and chips follow the supplied reference's generous horizontal composition.
- At intermediate widths, the composer remains full width within the content column, controls remain on one row where space permits, and chips wrap cleanly.
- Below approximately 680 px, the panel loses excess outer margin; the header stacks naturally, the controls split into usable rows, the send button retains a 44 px minimum target, and chips horizontally wrap without clipping.
- Long localized text, long chip labels, and a full 4,000-character textarea must not cause overflow. DOM order matches visual and keyboard order.

## Files and verification

- Update `client/src/components/ChatApp.tsx` only as needed to add semantic header and quick-action controls around the existing composer behavior.
- Update `client/src/index.css` for the composer layout and responsive styles, preserving the existing design tokens.
- Update or add focused component tests if existing test coverage makes the composer behavior practical to assert.
- Verify with the client test/build commands, a desktop and narrow rendered inspection, and the Impeccable detector for changed UI files.
