import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { TrendSnapshot, ActivityPoint } from '../services/trends';

interface Props {
  snapshots: TrendSnapshot[];
  activityPoints: ActivityPoint[];
  loading: boolean;
  onCommitClick: (sha: string) => void;
}

type MetricKey = 'healthScore' | 'securityCount' | 'fileCount' | 'functionCount' | 'testRatio';

const METRICS: { key: MetricKey; label: string; color: string }[] = [
  { key: 'healthScore',    label: 'Health Score',    color: '#3fb950' },
  { key: 'securityCount',  label: 'Security Issues', color: '#f85149' },
  { key: 'fileCount',      label: 'File Count',      color: '#58a6ff' },
  { key: 'functionCount',  label: 'Functions',       color: '#e3b341' },
  { key: 'testRatio',      label: 'Test Ratio %',    color: '#bc8cff' },
];

function ActivitySparklines({ points }: { points: ActivityPoint[] }) {
  if (points.length === 0) return null;
  const maxC = Math.max(...points.map(p => p.commitCount), 1);
  const maxA = Math.max(...points.map(p => p.authorCount), 1);
  const barW = 20;
  const gap = 4;
  const h = 40;
  const totalW = points.length * (barW + gap);

  function Bars({ values, max, color }: { values: number[]; max: number; color: string }) {
    return (
      <svg width={totalW} height={h} style={{ display: 'block' }}>
        {values.map((v, i) => {
          const bh = Math.max(2, Math.round((v / max) * h));
          return (
            <rect
              key={i}
              x={i * (barW + gap)}
              y={h - bh}
              width={barW}
              height={bh}
              fill={color}
              opacity={0.7}
              rx={2}
            />
          );
        })}
      </svg>
    );
  }

  return (
    <div style={{ marginBottom: '28px' }}>
      <h3 style={{ color: '#f0f6fc', fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px' }}>
        Activity — Last {points.length} Weeks
      </h3>
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        <div>
          <div style={{ color: '#8b949e', fontSize: '0.75rem', marginBottom: '4px' }}>Commits / week</div>
          <Bars values={points.map(p => p.commitCount)} max={maxC} color="#58a6ff" />
          <div style={{ display: 'flex', gap: gap, marginTop: '4px' }}>
            {points.map((p, i) => (
              <div key={i} style={{ width: barW, fontSize: '0.6rem', color: '#484f58', textAlign: 'center', overflow: 'hidden' }}>
                {p.weekLabel.split(' ')[1]}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={{ color: '#8b949e', fontSize: '0.75rem', marginBottom: '4px' }}>Authors / week</div>
          <Bars values={points.map(p => p.authorCount)} max={maxA} color="#bc8cff" />
        </div>
      </div>
    </div>
  );
}

function QualityChart({
  snapshots,
  activeMetrics,
  onCommitClick,
}: {
  snapshots: TrendSnapshot[];
  activeMetrics: Set<MetricKey>;
  onCommitClick: (sha: string) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; snap: TrendSnapshot } | null>(null);

  useEffect(() => {
    if (!svgRef.current || snapshots.length < 2) return;
    const el = svgRef.current;
    d3.select(el).selectAll('*').remove();

    const margin = { top: 20, right: 20, bottom: 50, left: 45 };
    const W = el.clientWidth || 600;
    const H = 260;
    const w = W - margin.left - margin.right;
    const h = H - margin.top - margin.bottom;

    const svg = d3.select(el)
      .attr('width', W)
      .attr('height', H)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain([0, snapshots.length - 1]).range([0, w]);

    svg.append('g')
      .selectAll('line')
      .data(d3.range(0, snapshots.length))
      .join('line')
      .attr('x1', (d: number) => x(d))
      .attr('x2', (d: number) => x(d))
      .attr('y1', 0)
      .attr('y2', h)
      .attr('stroke', '#21262d')
      .attr('stroke-dasharray', '3,3');

    svg.append('g')
      .attr('transform', `translate(0,${h})`)
      .selectAll('text')
      .data(snapshots)
      .join('text')
      .attr('x', (_: any, i: number) => x(i))
      .attr('y', 16)
      .attr('text-anchor', 'middle')
      .attr('fill', '#8b949e')
      .attr('font-size', '0.68rem')
      .text((d: TrendSnapshot) => d.shortSha);

    svg.append('g')
      .attr('transform', `translate(0,${h})`)
      .selectAll('text.date')
      .data(snapshots)
      .join('text')
      .attr('class', 'date')
      .attr('x', (_: any, i: number) => x(i))
      .attr('y', 28)
      .attr('text-anchor', 'middle')
      .attr('fill', '#484f58')
      .attr('font-size', '0.62rem')
      .text((d: TrendSnapshot) => d.date ? new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');

    const visibleMetrics = METRICS.filter(m => activeMetrics.has(m.key));

    for (const metric of visibleMetrics) {
      const values = snapshots.map(s => s[metric.key] as number);
      const yMin = Math.min(...values);
      const yMax = Math.max(...values);
      const yPad = yMax === yMin ? 5 : 0;
      const y = d3.scaleLinear().domain([Math.max(0, yMin - yPad), yMax + yPad]).range([h, 0]);

      const line = d3.line<TrendSnapshot>()
        .x((_: TrendSnapshot, i: number) => x(i))
        .y((d: TrendSnapshot) => y(d[metric.key] as number))
        .curve(d3.curveMonotoneX);

      svg.append('path')
        .datum(snapshots)
        .attr('fill', 'none')
        .attr('stroke', metric.color)
        .attr('stroke-width', 2)
        .attr('opacity', 0.85)
        .attr('d', line);

      svg.selectAll(`.dot-${metric.key}`)
        .data(snapshots)
        .join('circle')
        .attr('class', `dot-${metric.key}`)
        .attr('cx', (_: TrendSnapshot, i: number) => x(i))
        .attr('cy', (d: TrendSnapshot) => y(d[metric.key] as number))
        .attr('r', 5)
        .attr('fill', metric.color)
        .attr('stroke', '#0d1117')
        .attr('stroke-width', 2)
        .style('cursor', 'pointer')
        .on('mouseenter', function(event: MouseEvent, d: TrendSnapshot) {
          d3.select(this as SVGCircleElement).attr('r', 7);
          const rect = (svgRef.current as SVGSVGElement).getBoundingClientRect();
          setTooltip({ x: event.clientX - rect.left, y: event.clientY - rect.top - 10, snap: d });
        })
        .on('mouseleave', function() {
          d3.select(this as SVGCircleElement).attr('r', 5);
          setTooltip(null);
        })
        .on('click', (_: MouseEvent, d: TrendSnapshot) => onCommitClick(d.sha));
    }
  }, [snapshots, activeMetrics, onCommitClick]);

  if (snapshots.length < 2) {
    return <p style={{ color: '#8b949e', fontSize: '0.85rem' }}>Not enough commit history to show quality trends (need ≥ 2 commits).</p>;
  }

  return (
    <div style={{ position: 'relative' }}>
      <svg ref={svgRef} style={{ width: '100%', overflow: 'visible' }} />
      {tooltip && (
        <div style={{
          position: 'absolute',
          left: tooltip.x + 12,
          top: tooltip.y,
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '8px',
          padding: '10px 14px',
          fontSize: '0.78rem',
          color: '#f0f6fc',
          pointerEvents: 'none',
          zIndex: 100,
          minWidth: '200px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
        }}>
          <div style={{ fontFamily: 'monospace', color: '#58a6ff', marginBottom: '4px' }}>{tooltip.snap.shortSha}</div>
          <div style={{ color: '#8b949e', marginBottom: '2px', fontSize: '0.72rem' }}>
            {tooltip.snap.date ? new Date(tooltip.snap.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''} · {tooltip.snap.author}
          </div>
          <div style={{ color: '#c9d1d9', marginBottom: '8px', fontStyle: 'italic', fontSize: '0.72rem' }}>"{tooltip.snap.message}"</div>
          {METRICS.map(m => (
            <div key={m.key} style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '2px' }}>
              <span style={{ color: m.color }}>{m.label}</span>
              <span style={{ fontFamily: 'monospace' }}>{tooltip.snap[m.key]}{m.key === 'testRatio' ? '%' : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SkeletonChart() {
  return (
    <div style={{ padding: '16px 0' }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ height: 12, background: '#21262d', borderRadius: 4, marginBottom: 10, width: `${60 + i * 10}%` }} />
      ))}
      <div style={{ height: 180, background: '#161b22', borderRadius: 8, marginTop: 12 }} />
    </div>
  );
}

export default function MetricsTrendChart({ snapshots, activityPoints, loading, onCommitClick }: Props) {
  const [activeMetrics, setActiveMetrics] = useState<Set<MetricKey>>(
    new Set(['healthScore', 'securityCount'])
  );

  function toggleMetric(key: MetricKey) {
    setActiveMetrics(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div style={{ padding: '24px', marginTop: '8px' }}>
      <h2 style={{ color: '#f0f6fc', marginBottom: '20px' }}>Trends</h2>

      <ActivitySparklines points={activityPoints} />

      <div style={{ borderTop: '1px solid #21262d', paddingTop: '20px' }}>
        <h3 style={{ color: '#f0f6fc', fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          Quality — Last {loading ? '…' : snapshots.length} Commits
          {loading && <span style={{ color: '#8b949e', fontSize: '0.78rem', fontWeight: 400 }}>analysing…</span>}
        </h3>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {METRICS.map(m => {
            const on = activeMetrics.has(m.key);
            return (
              <button
                key={m.key}
                onClick={() => toggleMetric(m.key)}
                style={{
                  background: on ? `${m.color}22` : 'transparent',
                  border: `1px solid ${on ? m.color : '#30363d'}`,
                  color: on ? m.color : '#8b949e',
                  borderRadius: '20px',
                  padding: '3px 12px',
                  fontSize: '0.78rem',
                  fontWeight: on ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {loading
          ? <SkeletonChart />
          : <QualityChart snapshots={snapshots} activeMetrics={activeMetrics} onCommitClick={onCommitClick} />
        }
      </div>
    </div>
  );
}
