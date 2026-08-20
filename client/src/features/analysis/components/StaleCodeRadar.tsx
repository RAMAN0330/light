import React, { useState, useEffect } from 'react';
import { repositoryApi } from '../../../api/repositories';

interface StaleFile {
  path: string;
  basename: string;
  inDegree: number;
  daysSince: number;
  riskScore: number;
  lastModified: string;
}

interface StaleCodeRadarProps {
  accessToken: string;
  workspaceId: string;
  connectionId: string;
  files: any[];
  connections: any[];
}

function timeAgoFromDays(days: number): string {
  if (days < 1) return 'today';
  if (days < 30) return `${Math.round(days)}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

function riskColor(days: number): string {
  if (days < 30) return '#3fb950';
  if (days < 90) return '#d29922';
  return '#f85149';
}

export default function StaleCodeRadar({ accessToken, workspaceId, connectionId, files, connections }: StaleCodeRadarProps) {
  const [rows, setRows] = useState<StaleFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!files.length) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Build in-degree map from connections
        const inDegreeMap: Record<string, number> = {};
        for (const conn of connections) {
          const target = conn.to || conn.target || '';
          if (target) {
            inDegreeMap[target] = (inDegreeMap[target] || 0) + 1;
          }
        }

        // Take top 15 files by in-degree
        const sorted = [...files]
          .sort((a, b) => {
            const aPath = a.path || a.name || '';
            const bPath = b.path || b.name || '';
            return (inDegreeMap[bPath] || 0) - (inDegreeMap[aPath] || 0);
          })
          .slice(0, 15);

        // Fetch last commit date for each
        const results: StaleFile[] = [];
        for (const file of sorted) {
          if (cancelled) break;
          const filePath = file.path || file.name || '';
          if (!filePath) continue;

          let daysSince = 0;
          let lastModified = 'unknown';

          try {
            const result = await repositoryApi.commits(accessToken, workspaceId, connectionId, filePath, undefined, 1);
            if (result.status === 'completed' && Array.isArray(result.data) && result.data.length > 0) {
              const dateStr = result.data[0].commit?.author?.date;
              if (dateStr) {
                const ms = Date.now() - new Date(dateStr).getTime();
                daysSince = ms / 86400000;
                lastModified = dateStr;
              }
            }
          } catch {
            // skip fetch error for this file
          }

          const inDegree = inDegreeMap[filePath] || 0;
          const riskScore = Math.round(daysSince * Math.log(1 + inDegree) * 10) / 10;
          const basename = filePath.split('/').pop() || filePath;

          results.push({ path: filePath, basename, inDegree, daysSince, riskScore, lastModified });
        }

        if (!cancelled) {
          results.sort((a, b) => b.riskScore - a.riskScore);
          setRows(results);
        }
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to compute stale radar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [accessToken, workspaceId, connectionId, files, connections]);

  const containerStyle: React.CSSProperties = {
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: 8,
    padding: 24,
    color: '#f0f6fc',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  };

  if (loading) return (
    <div style={containerStyle}>
      <p style={{ color: '#8b949e' }}>Analyzing stale code... (fetching commit dates)</p>
    </div>
  );

  if (error) return (
    <div style={containerStyle}>
      <p style={{ color: '#f85149' }}>Error: {error}</p>
    </div>
  );

  if (!rows.length) return (
    <div style={containerStyle}>
      <p style={{ color: '#8b949e' }}>No file data available for stale analysis.</p>
    </div>
  );

  const maxRisk = rows[0]?.riskScore || 1;

  return (
    <div style={containerStyle}>
      <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 600, color: '#f0f6fc' }}>
        Stale Code Radar
      </h2>
      <p style={{ margin: '0 0 20px', fontSize: 13, color: '#8b949e' }}>
        Risk = Days Stale × log(1 + Dependents). Higher = more critical to update.
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #30363d' }}>
              <th style={{ textAlign: 'left', padding: '8px 10px', color: '#8b949e', fontWeight: 500 }}>File</th>
              <th style={{ textAlign: 'right', padding: '8px 10px', color: '#8b949e', fontWeight: 500 }}>Deps (in)</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', color: '#8b949e', fontWeight: 500 }}>Last Modified</th>
              <th style={{ textAlign: 'right', padding: '8px 10px', color: '#8b949e', fontWeight: 500 }}>Days Stale</th>
              <th style={{ textAlign: 'left', padding: '8px 10px', color: '#8b949e', fontWeight: 500, minWidth: 160 }}>Risk Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const barPct = maxRisk > 0 ? Math.round((row.riskScore / maxRisk) * 100) : 0;
              const color = riskColor(row.daysSince);
              const dayRounded = Math.round(row.daysSince);
              return (
                <tr key={row.path} style={{ borderBottom: '1px solid #21262d' }}>
                  <td style={{ padding: '10px 10px', fontFamily: 'monospace', color: '#79c0ff', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={row.path}>
                    {row.basename}
                  </td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', color: row.inDegree > 5 ? '#f85149' : '#f0f6fc' }}>
                    {row.inDegree}
                  </td>
                  <td style={{ padding: '10px 10px', color: '#8b949e', whiteSpace: 'nowrap' }}>
                    {row.lastModified === 'unknown' ? '—' : timeAgoFromDays(row.daysSince)}
                  </td>
                  <td style={{ padding: '10px 10px', textAlign: 'right', color: color }}>
                    {dayRounded}
                  </td>
                  <td style={{ padding: '10px 10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, background: '#21262d', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                        <div style={{
                          width: `${barPct}%`,
                          height: '100%',
                          background: color,
                          borderRadius: 4,
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                      <span style={{ fontSize: 12, color: '#8b949e', minWidth: 32, textAlign: 'right' }}>
                        {row.riskScore.toFixed(1)}
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
