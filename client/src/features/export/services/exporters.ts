import LZString from 'lz-string';

export interface GraphNode {
  id: string;
  name: string;
  layer?: string;
}

export interface GraphEdge {
  source: string | { id: string };
  target: string | { id: string };
  fn?: string;
}

export interface FilterState {
  layerFilter?: string | null;
  searchQuery?: string;
  folderFilter?: string | null;
}

function nodeId(n: GraphNode): string {
  return n.id.replace(/[^a-zA-Z0-9_]/g, '_');
}

function edgeSourceId(e: GraphEdge): string {
  return typeof e.source === 'string' ? e.source : e.source.id;
}

function edgeTargetId(e: GraphEdge): string {
  return typeof e.target === 'string' ? e.target : e.target.id;
}

export function toMermaid(nodes: GraphNode[], edges: GraphEdge[]): string {
  const nodeSet = new Set(nodes.map(n => n.id));
  const lines: string[] = ['graph TD'];

  const byLayer = new Map<string, GraphNode[]>();
  for (const n of nodes) {
    const layer = n.layer ?? 'other';
    if (!byLayer.has(layer)) byLayer.set(layer, []);
    byLayer.get(layer)!.push(n);
  }

  for (const [layer, layerNodes] of byLayer) {
    lines.push(`  subgraph ${layer}`);
    for (const n of layerNodes) {
      lines.push(`    ${nodeId(n)}["${n.name}"]`);
    }
    lines.push('  end');
  }

  for (const e of edges) {
    const src = edgeSourceId(e);
    const tgt = edgeTargetId(e);
    if (!nodeSet.has(src) || !nodeSet.has(tgt)) continue;
    const srcNode = nodes.find(n => n.id === src);
    const tgtNode = nodes.find(n => n.id === tgt);
    if (!srcNode || !tgtNode) continue;
    lines.push(`  ${nodeId(srcNode)} --> ${nodeId(tgtNode)}`);
  }

  return lines.join('\n');
}

export function toPlantUML(nodes: GraphNode[], edges: GraphEdge[]): string {
  const nodeSet = new Set(nodes.map(n => n.id));
  const lines: string[] = ['@startuml', 'skinparam componentStyle rectangle', ''];

  const byLayer = new Map<string, GraphNode[]>();
  for (const n of nodes) {
    const layer = n.layer ?? 'other';
    if (!byLayer.has(layer)) byLayer.set(layer, []);
    byLayer.get(layer)!.push(n);
  }

  for (const [layer, layerNodes] of byLayer) {
    lines.push(`package "${layer}" {`);
    for (const n of layerNodes) {
      lines.push(`  [${n.name}] as ${nodeId(n)}`);
    }
    lines.push('}');
    lines.push('');
  }

  for (const e of edges) {
    const src = edgeSourceId(e);
    const tgt = edgeTargetId(e);
    if (!nodeSet.has(src) || !nodeSet.has(tgt)) continue;
    const srcNode = nodes.find(n => n.id === src);
    const tgtNode = nodes.find(n => n.id === tgt);
    if (!srcNode || !tgtNode) continue;
    lines.push(`${nodeId(srcNode)} --> ${nodeId(tgtNode)}`);
  }

  lines.push('');
  lines.push('@enduml');
  return lines.join('\n');
}

export function toSVG(svgElement: SVGElement): string {
  const serializer = new XMLSerializer();
  const svgStr = serializer.serializeToString(svgElement);
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + svgStr;
}

export function toShareLink(repoUrl: string, filterState: FilterState): string {
  const payload = JSON.stringify({ repoUrl, filterState });
  const compressed = LZString.compressToEncodedURIComponent(payload);
  const base = window.location.origin + window.location.pathname;
  return `${base}?share=${compressed}`;
}

export function decodeShareLink(shareParam: string): { repoUrl: string; filterState: FilterState } | null {
  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(shareParam);
    if (!decompressed) return null;
    return JSON.parse(decompressed);
  } catch {
    return null;
  }
}
