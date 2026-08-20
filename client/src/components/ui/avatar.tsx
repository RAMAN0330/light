const PALETTE = [
  { bg: "#ccfbf1", fg: "#0f766e" },
  { bg: "#dbeafe", fg: "#1d4ed8" },
  { bg: "#fce7f3", fg: "#be185d" },
  { bg: "#fef3c7", fg: "#b45309" },
  { bg: "#e0e7ff", fg: "#4338ca" },
  { bg: "#dcfce7", fg: "#15803d" },
];

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Deterministic initials avatar — no photo data exists for members, so this never fabricates a face. */
export function Avatar({ seed, className = "" }: { seed: string; className?: string }) {
  const tone = PALETTE[hash(seed) % PALETTE.length];
  return (
    <span className={`avatar-initials ${className}`} style={{ background: tone.bg, color: tone.fg }}>
      {seed.slice(0, 2).toUpperCase()}
    </span>
  );
}
