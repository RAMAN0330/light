// Adapted from CodeGraph's groupedSigmaRendering.ts (client/src/features/workspace/components
// in the CodeGraph project this was ported from) — same dark-label-pill drawing approach and
// WebGL-context probe/release pattern, retinted to Orbital's palette instead of One Dark's.
import type { NodeLabelDrawingFunction } from "sigma/rendering";

export const LABEL_COLOR = "#e5e9f0";
export const LABEL_BACKGROUND = "#21252b";

export const drawAnalysisNodeLabel: NodeLabelDrawingFunction = (context, data, settings) => {
  if (!data.label) return;
  context.font = `${settings.labelWeight} ${settings.labelSize}px ${settings.labelFont}`;
  context.textBaseline = "middle";
  const x = data.x + data.size + 4;
  const width = context.measureText(data.label).width;
  context.fillStyle = LABEL_BACKGROUND;
  context.fillRect(x - 3, data.y - settings.labelSize / 2 - 3, width + 6, settings.labelSize + 6);
  context.fillStyle = LABEL_COLOR;
  context.fillText(data.label, x, data.y);
};

export function releaseWebglContext(context: WebGLRenderingContext | WebGL2RenderingContext): void {
  context.getExtension("WEBGL_lose_context")?.loseContext();
}

// graphify's file_type values (server/orbital_modules/upstream/code-intelligence/graphify/extract.py).
export const NODE_COLORS: Record<string, string> = {
  code: "#528bff",
  concept: "#a78bfa",
  doc_ref: "#e5c07b",
  rationale: "#98c379",
};

export function nodeColor(fileType: unknown): string {
  return NODE_COLORS[String(fileType)] || "#8b919d";
}

// graphify's edge `relation` values, grouped into a few visual buckets.
const EDGE_GROUPS: Record<string, string> = {
  calls: "#528bff",
  indirect_call: "#528bff",
  imports: "#a78bfa",
  imports_from: "#a78bfa",
  re_exports: "#a78bfa",
  contains: "#4b515b",
  defines: "#4b515b",
  rationale_for: "#e5c07b",
  cites: "#e5c07b",
  references: "#e5c07b",
};

export function edgeColor(relation: unknown): string {
  return EDGE_GROUPS[String(relation)] || "#3f4854";
}
