import React, { useState, useEffect } from 'react';
import { repositoryApi } from '../../../api/repositories';

const AUTHOR_COLORS = ['#238636','#1f6feb','#9e6a03','#8957e5','#cf222e','#0969da','#bf8700','#6e40c9'];
const AUTHOR_BG    = ['#0d2911','#0d1f3c','#271e00','#1e1230','#2d0f12','#051d36','#2b1f00','#1a1030'];

function hashToColorIndex(login: string): number {
  return login.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AUTHOR_COLORS.length;
}

const OWNERSHIP_STYLE = `
@keyframes shimmer {
  0% { background-position: -600px 0; }
  100% { background-position: 600px 0; }
}
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.co-card:hover {
  border-color: #388bfd !important;
  box-shadow: 0 0 0 1px #388bfd22, 0 6px 20px #0004 !important;
  transform: translateY(-2px) scale(1.01) !important;
}
`;

let omStyleInjected = false;
function ensureOMStyle() {
  if (omStyleInjected) return;
  omStyleInjected = true;
  const el = document.createElement('style');
  el.textContent = OWNERSHIP_STYLE;
  document.head.appendChild(el);
}

interface FolderOwnership {
  folder: string;
  fileCount: number;
  owner: string;
}

interface CodeOwnershipMapProps {
  accessToken: string;
  workspaceId: string;
  connectionId: string;
  files: any[];
}

function ShimmerBlock({ style }: { style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'linear-gradient(90deg, #161b22 25%, #21262d 50%, #161b22 75%)',
      backgroundSize: '600px 100%',
      animation: 'shimmer 1.4s infinite linear',
      borderRadius: 8,
      ...style,
    }} />
  );
}

export default function CodeOwnershipMap({ accessToken, workspaceId, connectionId, files }: CodeOwnershipMapProps) {
  const [ownership, setOwnership] = useState<FolderOwnership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  ensureOMStyle();

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

        // Extract unique top-level folders
        const folderCount: Record<string, number> = {};
        for (const file of files) {
          const filePath = file.path || file.name || '';
          const parts = filePath.split('/');
          const topFolder = parts.length > 1 ? parts[0] : '(root)';
          folderCount[topFolder] = (folderCount[topFolder] || 0) + 1;
        }

        // Sort by file count descending, take top 8
        const topFolders = Object.entries(folderCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([folder, count]) => ({ folder, count }));

        // For each folder, fetch 1 commit to determine owner
        const results: FolderOwnership[] = [];
        for (const { folder, count } of topFolders) {
          if (cancelled) break;
          let ownerLogin = 'unknown';

          try {
            const path = folder === '(root)' ? undefined : folder;
            const result = await repositoryApi.commits(accessToken, workspaceId, connectionId, path, undefined, 1);
            if (result.status === "completed" && Array.isArray(result.data) && result.data.length > 0) {
              ownerLogin = result.data[0].author?.login || result.data[0].commit?.author?.name || 'unknown';
            }
          } catch {
            // skip, keep 'unknown'
          }

          results.push({ folder, fileCount: count, owner: ownerLogin });
        }

        if (!cancelled) setOwnership(results);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to compute ownership map');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [accessToken, workspaceId, connectionId, files]);

  const containerStyle: React.CSSProperties = {
    background: '#0d1117',
    borderRadius: 12,
    padding: '28px 28px 32px',
    color: '#f0f6fc',
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    minHeight: 260,
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <ShimmerBlock style={{ width: 200, height: 28 }} />
        <ShimmerBlock style={{ width: 70, height: 22, borderRadius: 20 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {[0,1,2,3,4,5].map(i => (
          <ShimmerBlock key={i} style={{ height: 120, borderRadius: 10 }} />
        ))}
      </div>
    </div>
  );

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error) return (
    <div style={{ ...containerStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
      <div style={{ fontSize: 36 }}>⚠️</div>
      <div style={{ fontSize: 15, color: '#f85149', fontWeight: 600 }}>Failed to build ownership map</div>
      <div style={{ fontSize: 13, color: '#8b949e', maxWidth: 360, textAlign: 'center' }}>{error}</div>
    </div>
  );

  // ── Empty ────────────────────────────────────────────────────────────────────
  if (!ownership.length) return (
    <div style={{ ...containerStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
      <div style={{ fontSize: 36 }}>📂</div>
      <div style={{ fontSize: 15, color: '#8b949e' }}>No folder ownership data available.</div>
    </div>
  );

  // ── Computed ─────────────────────────────────────────────────────────────────
  const maxFiles = Math.max(...ownership.map(o => o.fileCount));
  const totalFiles = ownership.reduce((s, o) => s + o.fileCount, 0);

  // Author legend aggregates
  const authorTotals: Record<string, number> = {};
  for (const { owner: ownerLogin, fileCount } of ownership) {
    authorTotals[ownerLogin] = (authorTotals[ownerLogin] || 0) + fileCount;
  }
  const legendAuthors = Object.entries(authorTotals).sort((a, b) => b[1] - a[1]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={containerStyle}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f0f6fc', letterSpacing: '-0.3px' }}>
          Code Ownership
        </h2>
        <span style={{
          fontSize: 12, fontWeight: 600,
          background: '#21262d', color: '#8b949e',
          border: '1px solid #30363d',
          borderRadius: 20, padding: '3px 10px',
        }}>
          {files.length} files
        </span>
      </div>
      <p style={{ margin: '0 0 24px', fontSize: 13, color: '#8b949e', lineHeight: 1.5 }}>
        Top author per folder based on most recent commit. Card width scales with file count.
      </p>

      {/* Treemap-style ownership grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 14,
        marginBottom: 28,
      }}>
        {ownership.map(({ folder, fileCount, owner: ownerLogin }, idx) => {
          const colorIdx = ownerLogin !== 'unknown' ? hashToColorIndex(ownerLogin) : 4;
          const color = AUTHOR_COLORS[colorIdx];
          const bg = AUTHOR_BG[colorIdx];
          const pct = Math.round((fileCount / totalFiles) * 100);
          const span = Math.max(1, Math.round((fileCount / maxFiles) * 4));
          const initials = ownerLogin.slice(0, 2).toUpperCase();

          return (
            <div
              key={folder}
              className="co-card"
              style={{
                gridColumn: `span ${span}`,
                background: bg,
                border: `1px solid ${color}44`,
                borderRadius: 10,
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease',
                animation: `fadeInUp 0.3s ease both`,
                animationDelay: `${Math.min(idx * 40, 320)}ms`,
                minWidth: 0,
              }}
            >
              {/* Folder name */}
              <div style={{
                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                fontSize: 13,
                fontWeight: 600,
                color: '#79c0ff',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                {folder}/
              </div>

              {/* Owner row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0,
                  boxShadow: `0 0 6px ${color}66`,
                }}>
                  {initials}
                </div>
                <span style={{ fontSize: 12, color: '#c9d1d9', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ownerLogin}
                </span>
                <span style={{
                  marginLeft: 'auto', flexShrink: 0,
                  fontSize: 11, fontWeight: 600,
                  background: `${color}22`, color: color,
                  border: `1px solid ${color}44`,
                  borderRadius: 12, padding: '1px 8px',
                }}>
                  {fileCount}
                </span>
              </div>

              {/* Ownership % bar */}
              <div>
                <div style={{
                  height: 4, borderRadius: 4,
                  background: '#21262d',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${color}cc, ${color})`,
                    borderRadius: 4,
                    transition: 'width 0.6s ease',
                  }} />
                </div>
                <div style={{ fontSize: 11, color: '#8b949e', marginTop: 4 }}>
                  {pct}% of tracked files
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Author legend */}
      <div style={{
        borderTop: '1px solid #21262d',
        paddingTop: 18,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 11, color: '#8b949e', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px', marginRight: 4 }}>
          Authors
        </span>
        {legendAuthors.map(([login, count]) => {
          const colorIdx = login !== 'unknown' ? hashToColorIndex(login) : 4;
          const color = AUTHOR_COLORS[colorIdx];
          return (
            <div key={login} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: '#161b22',
              border: '1px solid #30363d',
              borderRadius: 20,
              padding: '4px 10px 4px 6px',
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: color, flexShrink: 0,
                boxShadow: `0 0 5px ${color}88`,
              }} />
              <span style={{ fontSize: 12, color: '#c9d1d9', fontWeight: 500 }}>{login}</span>
              <span style={{ fontSize: 11, color: '#8b949e' }}>{count} files</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
