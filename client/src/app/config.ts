// Ported from CodeGraph's app/config.ts so imports from the ported
// database/repository feature pages resolve. Not yet wired into Orbital's
// own routing/shell — those pages are inert until refined into real surfaces.
const DEFAULT_API_URL = "http://localhost:8000";

export const appConfig = Object.freeze({
  apiUrl: (import.meta.env.VITE_API_URL ?? DEFAULT_API_URL).replace(/\/$/, ""),
});
