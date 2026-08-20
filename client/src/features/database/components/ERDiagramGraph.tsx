import { useCallback, useEffect, useMemo } from 'react';
import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState, addEdge, MarkerType, Handle, Position } from 'reactflow';
import type { Connection, Edge, NodeTypes } from 'reactflow';
import 'reactflow/dist/style.css';

interface SchemaColumn { name: string; type: string; nullable: boolean; isPrimary: boolean; }
interface SchemaFK { column: string; referencedTable: string; referencedColumn: string; }
interface SchemaTable { name: string; columns: SchemaColumn[]; foreignKeys: SchemaFK[]; app?: string; file?: string; modelName?: string; dbTableName?: string; }

function TableNode({ data }: { data: any }) {
  if (data.compact) {
    return (
      <div style={{ background: 'var(--bg-secondary, #1a1a2e)', border: `1px solid ${data.focused ? 'var(--accent-green,#00ff9d)' : 'var(--accent-purple, #a78bfa)'}`, borderRadius: 7, minWidth: 150, maxWidth: 190, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, overflow: 'hidden', position: 'relative' }}>
        <Handle type="target" position={Position.Left} style={{ background: '#a78bfa', border: '2px solid #0f172a', width: 8, height: 8 }} />
        <div style={{ padding: '7px 9px', fontWeight: 700, fontSize: 11, color: data.focused ? 'var(--accent-green,#00ff9d)' : 'var(--accent-purple,#a78bfa)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={data.tableName}>
          {data.tableName}
        </div>
        <div style={{ padding: '0 9px 7px', color: 'var(--text-secondary,#94a3b8)', fontSize: 10 }}>
          {data.columnCount} cols · {data.relationCount} rels
        </div>
        <Handle type="source" position={Position.Right} style={{ background: '#4d9fff', border: '2px solid #0f172a', width: 8, height: 8 }} />
      </div>
    );
  }
  return (
    <div style={{ background: 'var(--bg-secondary, #1a1a2e)', border: '1px solid var(--accent-purple, #a78bfa)', borderRadius: 8, minWidth: 200, fontFamily: 'JetBrains Mono, monospace', fontSize: 11, overflow: 'hidden', position: 'relative' }}>
      <Handle type="target" position={Position.Left} style={{ background: '#a78bfa', border: '2px solid #0f172a', width: 10, height: 10 }} />
      <div style={{ background: 'linear-gradient(135deg,rgba(167,139,250,0.25),rgba(77,159,255,0.15))', padding: '6px 10px', fontWeight: 700, fontSize: 12, color: 'var(--accent-purple,#a78bfa)', borderBottom: '1px solid rgba(167,139,250,0.2)', letterSpacing: '0.5px' }}>
        {data.tableName}
      </div>
      {data.columns.map((col: SchemaColumn, i: number) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
          <span style={{ width: 14, textAlign: 'center', flexShrink: 0 }}>
            {col.isPrimary ? '🔑' : data.fkCols?.has(col.name) ? '🔗' : ''}
          </span>
          <span style={{ color: col.isPrimary ? 'var(--accent-green,#00ff9d)' : 'var(--text-primary,#e2e8f0)', fontWeight: col.isPrimary ? 600 : 400, flexGrow: 1 }}>{col.name}</span>
          <span style={{ color: 'var(--text-secondary,#94a3b8)', fontSize: 10, flexShrink: 0 }}>{col.type}</span>
          {col.nullable && <span style={{ color: 'var(--text-secondary,#64748b)', fontSize: 9 }}>?</span>}
        </div>
      ))}
      <Handle type="source" position={Position.Right} style={{ background: '#4d9fff', border: '2px solid #0f172a', width: 10, height: 10 }} />
    </div>
  );
}

const nodeTypes: NodeTypes = { tableNode: TableNode as any };

const ACCENT_COLORS = ['#a78bfa','#4d9fff','#00ff9d','#ff9f43','#ec4899','#22d3ee','#ff5f5f','#84cc16'];
const LARGE_SCHEMA_TABLES = 60;
const LARGE_SCHEMA_EDGES = 120;

function filterFocusedTables(tables: SchemaTable[], selectedTable?: string | null) {
  if (!selectedTable) return tables;
  const keep = new Set([selectedTable]);
  tables.forEach(t => {
    t.foreignKeys.forEach(fk => {
      if (t.name === selectedTable) keep.add(fk.referencedTable);
      if (fk.referencedTable === selectedTable) keep.add(t.name);
    });
  });
  return tables.filter(t => keep.has(t.name));
}

function layoutTables(tables: SchemaTable[], compact: boolean) {
  const tableByName = new Map(tables.map(t => [t.name, t]));
  const undirected = new Map<string, Set<string>>();
  const childrenByParent = new Map<string, Set<string>>();
  const fkToVisible = new Map<string, Set<string>>();

  tables.forEach(t => {
    undirected.set(t.name, new Set());
    childrenByParent.set(t.name, new Set());
    fkToVisible.set(t.name, new Set());
  });

  tables.forEach(t => {
    t.foreignKeys.forEach(fk => {
      if (!tableByName.has(fk.referencedTable)) return;
      undirected.get(t.name)!.add(fk.referencedTable);
      undirected.get(fk.referencedTable)!.add(t.name);
      childrenByParent.get(fk.referencedTable)!.add(t.name);
      fkToVisible.get(t.name)!.add(fk.referencedTable);
    });
  });

  const COL_W = compact ? 320 : 380;
  const ROW_H = compact ? 160 : 400;
  const COMPONENT_GAP_Y = compact ? 120 : 200;
  const ISOLATED_COLS = 4;
  const ISOLATED_COL_W = compact ? 260 : 320;
  const ISOLATED_ROW_H = compact ? 120 : 160;

  const positions = new Map<string, { x: number; y: number }>();
  const visited = new Set<string>();
  let yOffset = 0;

  const connectedComponents: string[][] = [];
  const isolatedTables: string[] = [];

  tables.forEach(start => {
    if (visited.has(start.name)) return;
    const component: string[] = [];
    const stack = [start.name];
    visited.add(start.name);
    while (stack.length) {
      const name = stack.pop()!;
      component.push(name);
      (undirected.get(name) || new Set()).forEach(next => {
        if (!visited.has(next)) { visited.add(next); stack.push(next); }
      });
    }
    if (component.length === 1 && (undirected.get(component[0])?.size ?? 0) === 0) {
      isolatedTables.push(component[0]);
    } else {
      connectedComponents.push(component);
    }
  });

  connectedComponents.forEach(component => {
    const depth = new Map<string, number>();
    const roots = component.filter(name => (fkToVisible.get(name)?.size || 0) === 0);
    const queue = (roots.length ? roots : [component[0]]).map(name => {
      depth.set(name, 0);
      return name;
    });

    for (let qi = 0; qi < queue.length; qi++) {
      const current = queue[qi];
      const nextDepth = (depth.get(current) || 0) + 1;
      (childrenByParent.get(current) || new Set()).forEach(child => {
        if (!component.includes(child)) return;
        if (!depth.has(child) || nextDepth < depth.get(child)!) {
          depth.set(child, nextDepth);
          queue.push(child);
        }
      });
    }
    component.forEach(name => { if (!depth.has(name)) depth.set(name, 0); });

    const byDepth = new Map<number, string[]>();
    component.forEach(name => {
      const d = depth.get(name) || 0;
      if (!byDepth.has(d)) byDepth.set(d, []);
      byDepth.get(d)!.push(name);
    });

    let componentRows = 1;
    Array.from(byDepth.entries()).forEach(([_d, names]) => {
      componentRows = Math.max(componentRows, names.length);
    });

    Array.from(byDepth.entries()).forEach(([d, names]) => {
      names.sort((a, b) => a.localeCompare(b));
      names.forEach((name, row) => {
        positions.set(name, { x: d * COL_W, y: yOffset + row * ROW_H });
      });
    });
    yOffset += componentRows * ROW_H + COMPONENT_GAP_Y;
  });

  if (isolatedTables.length > 0) {
    isolatedTables.sort((a, b) => a.localeCompare(b));
    isolatedTables.forEach((name, i) => {
      const col = i % ISOLATED_COLS;
      const row = Math.floor(i / ISOLATED_COLS);
      positions.set(name, { x: col * ISOLATED_COL_W, y: yOffset + row * ISOLATED_ROW_H });
    });
  }

  return positions;
}

function buildFlow(tables: SchemaTable[], selectedTable?: string | null) {
  const scopedTables = filterFocusedTables(tables, selectedTable);
  const relationTotal = tables.reduce((s, t) => s + t.foreignKeys.length, 0);
  const compact = tables.length > LARGE_SCHEMA_TABLES || relationTotal > LARGE_SCHEMA_EDGES;
  const visibleIds = new Set(scopedTables.map(t => t.name));
  const positions = layoutTables(scopedTables, compact);

  const nodes = scopedTables.map((t) => {
    const fkCols = new Set(t.foreignKeys.map(fk => fk.column));
    const relationCount = t.foreignKeys.length + tables.reduce((s, other) => s + other.foreignKeys.filter(fk => fk.referencedTable === t.name).length, 0);
    return {
      id: t.name,
      type: 'tableNode',
      position: positions.get(t.name) || { x: 0, y: 0 },
      data: { tableName: t.name, columns: compact ? t.columns.slice(0, 6) : t.columns, fkCols, compact, columnCount: t.columns.length, relationCount, focused: selectedTable === t.name },
    };
  });

  const edgeSet = new Set<string>();
  const edges: any[] = [];
  scopedTables.forEach((t, ti) => {
    t.foreignKeys.forEach((fk) => {
      if (!visibleIds.has(fk.referencedTable)) return;
      const id = `${t.name}.${fk.column}->${fk.referencedTable}.${fk.referencedColumn}`;
      if (edgeSet.has(id)) return;
      edgeSet.add(id);
      edges.push({
        id,
        source: t.name,
        target: fk.referencedTable,
        label: compact ? undefined : `${fk.column} -> ${fk.referencedColumn}`,
        animated: !compact,
        markerEnd: { type: MarkerType.ArrowClosed, color: ACCENT_COLORS[ti % ACCENT_COLORS.length] },
        style: { stroke: ACCENT_COLORS[ti % ACCENT_COLORS.length], strokeWidth: 1.5 },
        labelStyle: { fill: '#94a3b8', fontSize: 9, fontFamily: 'JetBrains Mono, monospace' },
        labelBgStyle: { fill: '#0f172a', fillOpacity: 0.85 },
      });
    });
  });

  return { nodes, edges, compact };
}

export default function ERDiagramGraph({ schema, selectedTable, isRealSchema }: { schema?: { tables: SchemaTable[] }; selectedTable?: string | null; isRealSchema?: boolean }) {
  const flow = useMemo(() => {
    if (schema?.tables?.length) return buildFlow(schema.tables, selectedTable);
    if (isRealSchema) return buildFlow([], selectedTable);
    // Demo data when no real schema
    return buildFlow([
      { name: 'users', columns: [{ name: 'id', type: 'serial', nullable: false, isPrimary: true }, { name: 'email', type: 'varchar', nullable: false, isPrimary: false }, { name: 'created_at', type: 'timestamp', nullable: true, isPrimary: false }], foreignKeys: [] },
      { name: 'orders', columns: [{ name: 'id', type: 'serial', nullable: false, isPrimary: true }, { name: 'user_id', type: 'integer', nullable: false, isPrimary: false }, { name: 'total', type: 'numeric', nullable: false, isPrimary: false }], foreignKeys: [{ column: 'user_id', referencedTable: 'users', referencedColumn: 'id' }] },
      { name: 'products', columns: [{ name: 'id', type: 'serial', nullable: false, isPrimary: true }, { name: 'name', type: 'varchar', nullable: false, isPrimary: false }, { name: 'price', type: 'numeric', nullable: false, isPrimary: false }], foreignKeys: [] },
    ]);
  }, [schema, selectedTable]);

  const [nodes, setNodes, onNodesChange] = useNodesState(flow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flow.edges);
  const onConnect = useCallback((params: Edge | Connection) => setEdges(eds => addEdge(params, eds)), [setEdges]);

  useEffect(() => {
    setNodes(flow.nodes);
    setEdges(flow.edges);
  }, [flow.nodes, flow.edges, setNodes, setEdges]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 500, background: 'var(--bg-main,#0d0d1a)', borderRadius: 12, border: '1px solid var(--border-glass)', overflow: 'hidden', position: 'absolute', inset: 0 }}>
      <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect} nodeTypes={nodeTypes} fitView onlyRenderVisibleElements>
        {!flow.compact && <MiniMap nodeColor={n => ACCENT_COLORS[nodes.findIndex(x => x.id === n.id) % ACCENT_COLORS.length]} style={{ background: 'var(--bg-secondary)' }} maskColor="rgba(0,0,0,0.5)" />}
        <Controls style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', border: '1px solid var(--border-glass)' }} />
        <Background color="rgba(255,255,255,0.04)" gap={20} />
      </ReactFlow>
    </div>
  );
}
