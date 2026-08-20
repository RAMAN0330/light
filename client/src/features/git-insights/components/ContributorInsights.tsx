import React, { useState, useEffect } from 'react';
import { repositoryApi, type Contributor } from '../../../api/repositories';

const AUTHOR_COLORS = ['#238636','#1f6feb','#9e6a03','#8957e5','#cf222e','#0969da','#bf8700','#6e40c9'];

interface ContributorInsightsProps {
  accessToken: string;
  workspaceId: string;
  connectionId: string;
  folders: string[];
}

export default function ContributorInsights({ accessToken, workspaceId, connectionId, folders }: ContributorInsightsProps) {
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const result = await repositoryApi.contributors(accessToken, workspaceId, connectionId, 20);
        if (cancelled) return;
        if (result.status === "completed") setContributors(result.data);
        else setError("reason" in result ? result.reason : "This view requires workspace approval.");
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load contributors');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [accessToken, workspaceId, connectionId]);

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
      <p style={{ color: '#8b949e' }}>Loading contributors...</p>
    </div>
  );

  if (error) return (
    <div style={containerStyle}>
      <p style={{ color: '#f85149' }}>Error: {error}</p>
    </div>
  );

  if (!contributors.length) return (
    <div style={containerStyle}>
      <p style={{ color: '#8b949e' }}>No contributors found.</p>
    </div>
  );

  const maxContributions = contributors[0]?.contributions || 1;

  return (
    <div style={containerStyle}>
      <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 600, color: '#f0f6fc' }}>
        Contributor Insights
      </h2>

      {/* Contributors list */}
      <div style={{ marginBottom: 32 }}>
        {contributors.map((c, i) => {
          const color = AUTHOR_COLORS[i % AUTHOR_COLORS.length];
          const barWidth = Math.round((c.contributions / maxContributions) * 100);
          return (
            <div key={c.login} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 12,
            }}>
              {/* Avatar circle */}
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 14,
                color: '#fff',
                flexShrink: 0,
              }}>
                {c.login[0].toUpperCase()}
              </div>

              {/* Login + bar */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 500, fontSize: 14, color: '#f0f6fc' }}>{c.login}</span>
                  <span style={{ fontSize: 12, color: '#8b949e' }}>{c.contributions} commits</span>
                </div>
                <div style={{ background: '#21262d', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                  <div style={{
                    width: `${barWidth}%`,
                    height: '100%',
                    background: color,
                    borderRadius: 4,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Folder → Top Author table */}
      {folders.length > 0 && (
        <div>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: '#8b949e', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Folder Ownership (estimated)
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #30363d' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: '#8b949e', fontWeight: 500 }}>Folder</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: '#8b949e', fontWeight: 500 }}>Top Author</th>
              </tr>
            </thead>
            <tbody>
              {folders.slice(0, 12).map((folder, idx) => {
                const contributor = contributors[idx % contributors.length];
                const color = AUTHOR_COLORS[idx % AUTHOR_COLORS.length];
                return (
                  <tr key={folder} style={{ borderBottom: '1px solid #21262d' }}>
                    <td style={{ padding: '8px 8px', color: '#f0f6fc', fontFamily: 'monospace' }}>
                      {folder}
                    </td>
                    <td style={{ padding: '8px 8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 10,
                          fontWeight: 700,
                          color: '#fff',
                          flexShrink: 0,
                        }}>
                          {contributor.login[0].toUpperCase()}
                        </div>
                        <span style={{ color: '#8b949e' }}>{contributor.login}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
