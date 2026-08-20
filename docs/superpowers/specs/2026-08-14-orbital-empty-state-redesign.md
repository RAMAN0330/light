# Orbital Empty-State Redesign

## Goal

Replace the generic centered empty screen with a recognizably Orbital default experience that guides a new conversation without compromising the normal chat layout.

## Experience

The blank workspace becomes a centered command surface. A compact orbital mark and a direct headline establish the brand, while three concise prompt suggestions give new users an immediate, low-friction first action. Selecting a suggestion places its text in the existing composer; it does not automatically send a message.

The composer becomes an orbit dock: a white, softly elevated surface with a restrained cobalt perimeter response on focus. The response mode remains available but becomes a compact segmented control. The dock is centered and capped at a readable width on the empty state. Once messages exist, it returns to the normal bottom composer layout.

## Constraints

- Keep the current Light/Cobalt Orbital visual language.
- Preserve WebSocket streaming, modes, keyboard shortcuts, messages, and mobile behavior.
- Keep animation limited to focus and empty-state entrance, respecting reduced-motion preferences.
- Use the existing Tailwind/local UI primitives; do not add a dependency.

## Verification

- Test a suggestion populates the composer and does not send.
- Run the current client test suite and production build.
- Run the Impeccable detector over the modified UI files.
