// Force-directed dependency graph for a deep-analysis AnalysisGraph result.
// Adapted from CodeGraph's GroupedSigmaGraph.tsx (sigma.js + graphology, same
// nodeReducer/edgeReducer dim-unrelated-on-select pattern for blast-radius-
// style highlighting) — simplified here since AnalysisGraph's nodes have no
// pre-computed folder/x/y layout, so positions come from forceatlas2 instead
// of CodeGraph's custom folder-packing layout.
import { useEffect, useRef, useState } from "react";
import GraphologyGraph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import Sigma from "sigma";
import { EdgeArrowProgram } from "sigma/rendering";
import type { AnalysisGraph } from "../../../api/repositories";
import { drawAnalysisNodeLabel, edgeColor, LABEL_COLOR, nodeColor, releaseWebglContext } from "./analysisGraphRendering";

const MAX_LAID_OUT_NODES = 4000;

type Tooltip = { title: string; detail: string; x: number; y: number };

export function AnalysisGraphView({ graph, onSelectNode }: { graph: AnalysisGraph; onSelectNode?: (nodeId: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<Sigma | null>(null);
  const graphologyRef = useRef<GraphologyGraph | null>(null);
  const selectedRef = useRef<string | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const [webglError, setWebglError] = useState(false);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !graph.nodes.length) return;

    const canvas = document.createElement("canvas");
    const probe = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (!probe) { setWebglError(true); return; }
    releaseWebglContext(probe);

    const nodes = graph.nodes.slice(0, MAX_LAID_OUT_NODES);
    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = graph.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

    const g = new GraphologyGraph({ multi: false, type: "directed" });
    nodes.forEach((node, index) => {
      const angle = (index / nodes.length) * 2 * Math.PI;
      g.addNode(node.id, {
        x: Math.cos(angle) * 10,
        y: Math.sin(angle) * 10,
        label: String(node.label ?? node.id),
        size: 4,
        color: nodeColor(node.file_type),
        source_file: node.source_file,
        source_location: node.source_location,
        file_type: node.file_type,
      });
    });
    edges.forEach((edge, index) => {
      if (g.hasNode(edge.source) && g.hasNode(edge.target) && !g.hasEdge(edge.source, edge.target)) {
        g.addEdgeWithKey(`e${index}`, edge.source, edge.target, {
          size: 1,
          color: edgeColor(edge.relation),
          type: "arrow",
          relation: edge.relation,
        });
      }
    });

    // Node size reflects degree once the graph is built, so hub files/symbols read as bigger.
    g.forEachNode((node) => {
      const degree = g.degree(node);
      g.setNodeAttribute(node, "size", Math.max(3, Math.min(14, 3 + Math.sqrt(degree + 1) * 1.6)));
    });

    if (nodes.length > 1) {
      forceAtlas2.assign(g, { iterations: Math.min(150, Math.max(30, Math.round(20000 / nodes.length))), settings: { gravity: 1, scalingRatio: 8, barnesHutOptimize: nodes.length > 400 } });
    }
    graphologyRef.current = g;

    let renderer: Sigma;
    try {
      renderer = new Sigma(g, container, {
        renderLabels: true,
        labelDensity: 0.7,
        labelGridCellSize: 100,
        labelRenderedSizeThreshold: 8,
        labelColor: { color: LABEL_COLOR },
        defaultDrawNodeLabel: drawAnalysisNodeLabel,
        defaultDrawNodeHover: drawAnalysisNodeLabel,
        minCameraRatio: 0.02,
        defaultEdgeType: "arrow",
        edgeProgramClasses: { arrow: EdgeArrowProgram },
        zIndex: true,
        nodeReducer: (node, data) => {
          const active = selectedRef.current;
          const hovered = hoveredRef.current === node;
          const related = !active || active === node || g.areNeighbors(active, node);
          return {
            ...data,
            color: related ? data.color : "#4b515b",
            forceLabel: node === active || hovered,
            highlighted: node === active || hovered,
            zIndex: node === active ? 3 : hovered ? 2 : related ? 1 : 0,
          };
        },
        edgeReducer: (edge, data) => {
          const active = selectedRef.current;
          const related = !active || g.source(edge) === active || g.target(edge) === active;
          return {
            ...data,
            color: active ? (related ? "#abb2bf" : "#2a2e35") : data.color,
            size: active && related ? Math.max(1.6, Number(data.size)) : data.size,
            zIndex: related ? 1 : 0,
          };
        },
      });
    } catch {
      g.clear();
      graphologyRef.current = null;
      setWebglError(true);
      return;
    }
    rendererRef.current = renderer;

    renderer.on("clickNode", ({ node }) => {
      selectedRef.current = selectedRef.current === node ? null : node;
      setSelectedId(selectedRef.current);
      onSelectNode?.(node);
      renderer.refresh();
    });
    renderer.on("clickStage", () => {
      selectedRef.current = null;
      setSelectedId(null);
      renderer.refresh();
    });
    renderer.on("enterNode", ({ node, event }) => {
      hoveredRef.current = node;
      const data = g.getNodeAttributes(node);
      const pointer = "touches" in event.original ? event.original.touches[0] : event.original;
      setTooltip({
        title: String(data.label),
        detail: `${data.source_file || "unknown file"}${data.source_location ? ` · ${data.source_location}` : ""} · ${data.file_type || "code"}`,
        x: pointer.clientX + 12,
        y: pointer.clientY + 12,
      });
      renderer.refresh();
    });
    renderer.on("leaveNode", () => {
      hoveredRef.current = null;
      setTooltip(null);
      renderer.refresh();
    });

    return () => {
      renderer.kill();
      g.clear();
      rendererRef.current = null;
      graphologyRef.current = null;
      selectedRef.current = null;
      hoveredRef.current = null;
    };
  }, [graph]);

  if (!graph.nodes.length) return <p className="project-empty">No structural nodes to visualize.</p>;
  if (webglError) return <p className="project-empty">WebGL is unavailable — enable hardware acceleration to view the dependency graph.</p>;

  return (
    <div className="analysis-graph-view">
      <div className="analysis-graph-legend">
        <span><i style={{ background: "#528bff" }} />Code</span>
        <span><i style={{ background: "#a78bfa" }} />Concept</span>
        <span><i style={{ background: "#e5c07b" }} />Doc reference</span>
        <span><i style={{ background: "#98c379" }} />Rationale</span>
      </div>
      <div ref={containerRef} className="analysis-graph-stage" />
      {tooltip && (
        <div className="analysis-graph-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          <strong>{tooltip.title}</strong>
          <small>{tooltip.detail}</small>
        </div>
      )}
      {selectedId && (
        <button type="button" className="analysis-graph-clear" onClick={() => { selectedRef.current = null; setSelectedId(null); rendererRef.current?.refresh(); }}>
          Clear selection
        </button>
      )}
    </div>
  );
}
