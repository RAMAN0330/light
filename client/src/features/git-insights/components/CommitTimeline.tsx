import React, { useState, useEffect, useCallback } from 'react';
import { repositoryApi } from '../../../api/repositories';

const AUTHOR_COLORS = ['#238636','#1f6feb','#9e6a03','#8957e5','#cf222e','#0969da','#bf8700','#6e40c9'];

function hashToColorIndex(login: string): number {
  return login.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AUTHOR_COLORS.length;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay > 0) return `${diffDay}d ago`;
  if (diffHr > 0) return `${diffHr}h ago`;
  if (diffMin > 0) return `${diffMin}m ago`;
  return 'just now';
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

type CommitItem = import('../../../api/repositories').CommitSummary;

interface CommitTimelineProps {
  accessToken: string;
  workspaceId: string;
  connectionId: string;
  branch: string;
}

// Shimmer skeleton animation via a style tag injected once
const SHIMMER_STYLE = `
@keyframes shimmer {
  0% { background-position: -600px 0; }
  100% { background-position: 600px 0; }
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.ct-card:hover {
  background: #1c2128 !important;
  border-color: #388bfd !important;
  box-shadow: 0 0 0 1px #388bfd22, 0 4px 16px #0003 !important;
  transform: translateY(-1px);
}
.ct-sha:hover {
  background: #388bfd22 !important;
  border-color: #388bfd !important;
  color: #79c0ff !important;
  cursor: pointer;
}
`;

let styleInjected = false;
function ensureStyle() {
  if (styleInjected) return;
  styleInjected = true;
  const el = document.createElement('style');
  el.textContent = SHIMMER_STYLE;
  document.head.appendChild(el);
}

function SkeletonRow() {
  const shimmer: React.CSSProperties = {
    background: 'linear-gradient(90deg, #21262d 25%, #2d333b 50%, #21262d 75%)',
    backgroundSize: '600px 100%',
    animation: 'shimmer 1.4s infinite linear',
    borderRadius: 4,
  };
  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 20, alignItems: 'flex-start' }}>
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', ...shimmer }} />
      </div>
      <div style={{
        flex: 1, background: '#21262d', border: '1px solid #30363d',
        borderRadius: 8, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ width: 56, height: 18, ...shimmer }} />
          <div style={{ width: 80, height: 18, ...shimmer }} />
          <div style={{ width: 60, height: 18, marginLeft: 'auto', ...shimmer }} />
        </div>
        <div style={{ width: '70%', height: 14, ...shimmer }} />
        <div style={{ width: '45%', height: 14, ...shimmer }} />
      </div>
    </div>
  );
}

export default function CommitTimeline({ accessToken, workspaceId, connectionId, branch }: CommitTimelineProps) {
  const [commits, setCommits] = useState<CommitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  ensureStyle();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const result = await repositoryApi.commits(accessToken, workspaceId, connectionId, undefined, branch, 30);
        if (cancelled) return;
        if (result.status === "completed") setCommits(result.data);
        else setError("reason" in result ? result.reason : "This view requires workspace approval.");
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load commits');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [accessToken, workspaceId, connectionId, branch]);

  const handleCopySha = useCallback((sha: string) => {
    navigator.clipboard.writeText(sha).catch(() => {});
    setCopiedSha(sha);
    setTimeout(() => setCopiedSha(null), 1500);
  }, []);

  const containerStyle: React.CSSProperties = {
    background: '#0d1117',
    borderRadius: 12,
    padding: '28px 28px 32px',
    color: '#f0f6fc',
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    minHeight: 300,
  };

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <div style={{
          width: 180, height: 28,
          background: 'linear-gradient(90deg, #21262d 25%, #2d333b 50%, #21262d 75%)',
          backgroundSize: '600px 100%', animation: 'shimmer 1.4s infinite linear', borderRadius: 6,
        }} />
        <div style={{
          width: 80, height: 22,
          background: 'linear-gradient(90deg, #21262d 25%, #2d333b 50%, #21262d 75%)',
          backgroundSize: '600px 100%', animation: 'shimmer 1.4s infinite linear', borderRadius: 20,
        }} />
      </div>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 12, marginBottom: 28,
      }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            height: 72, borderRadius: 10,
            background: 'linear-gradient(90deg, #161b22 25%, #21262d 50%, #161b22 75%)',
            backgroundSize: '600px 100%', animation: 'shimmer 1.4s infinite linear',
          }} />
        ))}
      </div>
      {[0,1,2,3,4].map(i => <SkeletonRow key={i} />)}
    </div>
  );

  // ── Error state ──────────────────────────────────────────────────────────────
  if (error) return (
    <div style={{ ...containerStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 200 }}>
      <div style={{ fontSize: 36 }}>⚠️</div>
      <div style={{ fontSize: 15, color: '#f85149', fontWeight: 600 }}>Failed to load commits</div>
      <div style={{ fontSize: 13, color: '#8b949e', maxWidth: 360, textAlign: 'center' }}>{error}</div>
    </div>
  );

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!commits.length) return (
    <div style={{ ...containerStyle, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 200 }}>
      <div style={{ fontSize: 36 }}>📭</div>
      <div style={{ fontSize: 15, color: '#8b949e' }}>No commits found on branch "{branch}".</div>
    </div>
  );

  // ── Computed stats ───────────────────────────────────────────────────────────
  const uniqueAuthors = [...new Set(commits.map(c => c.author?.login || c.commit.author.name || 'unknown'))];
  const authorCounts: Record<string, number> = {};
  for (const c of commits) {
    const login = c.author?.login || c.commit.author.name || 'unknown';
    authorCounts[login] = (authorCounts[login] || 0) + 1;
  }
  const mostActiveAuthor = Object.entries(authorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
  const dates = commits.map(c => c.commit.author.date).sort();
  const firstDate = formatDate(dates[0]);
  const lastDate = formatDate(dates[dates.length - 1]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={containerStyle}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f0f6fc', letterSpacing: '-0.3px' }}>
          Commit History
        </h2>
        <span style={{
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
          fontSize: 12, fontWeight: 500,
          background: '#1f3a5f', color: '#79c0ff',
          border: '1px solid #1f6feb55',
          borderRadius: 20, padding: '3px 10px',
          letterSpacing: '0.3px',
        }}>
          #{branch}
        </span>
        <span style={{
          fontSize: 12, fontWeight: 600,
          background: '#21262d', color: '#8b949e',
          border: '1px solid #30363d',
          borderRadius: 20, padding: '3px 10px',
        }}>
          {commits.length} commits
        </span>
      </div>

      {/* Stats row */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 12,
        marginBottom: 32,
      }}>
        {[
          { label: 'Total Commits', value: commits.length, accent: '#58a6ff' },
          { label: 'Unique Authors', value: uniqueAuthors.length, accent: '#3fb950' },
          { label: 'Date Range', value: `${firstDate} → ${lastDate}`, accent: '#d2a8ff', small: true },
          { label: 'Most Active', value: mostActiveAuthor, accent: '#e3b341', small: true },
        ].map(({ label, value, accent, small }) => (
          <div key={label} style={{
            background: '#161b22',
            border: '1px solid #21262d',
            borderRadius: 10,
            padding: '14px 18px',
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            <div style={{ fontSize: 11, color: '#8b949e', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              {label}
            </div>
            <div style={{ fontSize: small ? 13 : 22, fontWeight: 700, color: accent, lineHeight: 1.2, wordBreak: 'break-word' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Timeline list */}
      <div style={{ position: 'relative' }}>
        {/* Vertical guide line */}
        <div style={{
          position: 'absolute',
          left: 17,
          top: 18,
          bottom: 18,
          width: 2,
          background: 'linear-gradient(to bottom, #30363d 0%, #21262d 100%)',
          borderRadius: 2,
          zIndex: 0,
        }} />

        {commits.map((commit, idx) => {
          const login = commit.author?.login || commit.commit.author.name || 'unknown';
          const colorIdx = hashToColorIndex(login);
          const color = AUTHOR_COLORS[colorIdx];
          const sha7 = commit.sha.slice(0, 7);
          const fullMsg = commit.commit.message.split('\n')[0];
          const message = fullMsg.length > 72 ? fullMsg.slice(0, 72) + '…' : fullMsg;
          const date = commit.commit.author.date;
          const initials = login.slice(0, 2).toUpperCase();

          return (
            <div
              key={commit.sha}
              style={{
                display: 'flex',
                gap: 14,
                marginBottom: idx === commits.length - 1 ? 0 : 14,
                position: 'relative',
                animation: `fadeIn 0.3s ease both`,
                animationDelay: `${Math.min(idx * 30, 300)}ms`,
              }}
            >
              {/* Timeline dot column */}
              <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: `${color}22`,
                  border: `2px solid ${color}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  color: color,
                  letterSpacing: '0.5px',
                  boxShadow: `0 0 0 3px #0d1117, 0 0 8px ${color}44`,
                }}>
                  {initials}
                </div>
              </div>

              {/* Card */}
              <div
                className="ct-card"
                style={{
                  flex: 1,
                  background: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: 8,
                  padding: '11px 16px',
                  minWidth: 0,
                  transition: 'background 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease',
                }}
              >
                {/* Top row: sha + author + timestamp */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span
                    className="ct-sha"
                    title={copiedSha === commit.sha ? 'Copied!' : 'Click to copy SHA'}
                    onClick={() => handleCopySha(commit.sha)}
                    style={{
                      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                      fontSize: 11,
                      background: '#21262d',
                      border: '1px solid #30363d',
                      borderRadius: 5,
                      padding: '2px 7px',
                      color: copiedSha === commit.sha ? '#3fb950' : '#8b949e',
                      transition: 'background 0.1s, border-color 0.1s, color 0.1s',
                      userSelect: 'none',
                    }}
                  >
                    {copiedSha === commit.sha ? '✓ copied' : sha7}
                  </span>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%',
                      background: color, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff',
                    }}>
                      {login[0].toUpperCase()}
                    </div>
                    <span style={{ fontSize: 12, color: '#8b949e', fontWeight: 500 }}>{login}</span>
                  </div>

                  <span style={{ fontSize: 11, color: '#484f58', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                    {timeAgo(date)}
                  </span>
                </div>

                {/* Commit message */}
                <p
                  title={fullMsg}
                  style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#e6edf3',
                    lineHeight: 1.45,
                    wordBreak: 'break-word',
                  }}
                >
                  {message}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
