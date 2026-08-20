import { useState, useEffect } from 'react';
import { repositoryApi, type CommitSummary } from '../../../api/repositories';

interface BlameHeatmapProps {
  accessToken: string;
  workspaceId: string;
  connectionId: string;
  filePath: string;
}

function ageColor(dateStr: string): string {
  const days = (Date.now() - new Date(dateStr).getTime()) / 86400000;
  if (days < 30) return '#3fb950';
  if (days < 90) return '#d29922';
  if (days < 180) return '#f0883e';
  return '#f85149';
}

export default function BlameHeatmap({ accessToken, workspaceId, connectionId, filePath }: BlameHeatmapProps) {
  const [commits, setCommits] = useState<CommitSummary[]>([]);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);

  useEffect(() => {
    if (!filePath) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await repositoryApi.commits(accessToken, workspaceId, connectionId, filePath, undefined, 20);
        if (!cancelled && result.status === "completed" && Array.isArray(result.data)) setCommits(result.data);
      } catch {
        // silently fail — render nothing on error
      }
    })();
    return () => { cancelled = true; };
  }, [accessToken, workspaceId, connectionId, filePath]);

  if (!commits.length) return null;

  const blockWidthPct = 100 / commits.length;

  return (
    <div style={{
      marginBottom: 12,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* Heatmap strip */}
      <div style={{
        display: 'flex',
        height: 12,
        borderRadius: 4,
        overflow: 'hidden',
        border: '1px solid #30363d',
        position: 'relative',
      }}>
        {commits.map((c) => {
          const color = ageColor(c.commit.author.date);
          const tooltipText =
            `${c.commit.author.name} · ${new Date(c.commit.author.date).toLocaleDateString()} · ${c.commit.message.slice(0, 60)}`;
          return (
            <div
              key={c.sha}
              title={tooltipText}
              onMouseEnter={(e) => setTooltip({ x: e.clientX, y: e.clientY, content: tooltipText })}
              onMouseLeave={() => setTooltip(null)}
              style={{
                width: `${blockWidthPct}%`,
                height: '100%',
                background: color,
                cursor: 'default',
              }}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
        fontSize: 11,
        color: '#8b949e',
      }}>
        <span>Recent</span>
        {['#3fb950','#d29922','#f0883e','#f85149'].map(c => (
          <div key={c} style={{ width: 16, height: 8, background: c, borderRadius: 2 }} />
        ))}
        <span>Stale</span>
      </div>

      {/* Floating tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed',
          left: tooltip.x + 12,
          top: tooltip.y - 8,
          background: '#1c2128',
          border: '1px solid #30363d',
          borderRadius: 6,
          padding: '6px 10px',
          fontSize: 12,
          color: '#f0f6fc',
          pointerEvents: 'none',
          zIndex: 9999,
          maxWidth: 320,
          wordBreak: 'break-word',
        }}>
          {tooltip.content}
        </div>
      )}
    </div>
  );
}
