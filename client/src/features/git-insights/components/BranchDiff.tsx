import { useState, useEffect, useCallback } from 'react';
import { repositoryApi } from '../../../api/repositories';
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import javascript from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import go from 'highlight.js/lib/languages/go';
import java from 'highlight.js/lib/languages/java';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';

hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('python', python);
hljs.registerLanguage('go', go);
hljs.registerLanguage('java', java);
hljs.registerLanguage('css', css);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('json', json);
hljs.registerLanguage('markdown', markdown);

const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript',
  js: 'javascript', jsx: 'javascript',
  py: 'python',
  go: 'go',
  java: 'java',
  css: 'css', scss: 'css',
  html: 'xml', xml: 'xml',
  json: 'json',
  md: 'markdown',
};

function detectLang(patch: string): string {
  const m = patch.match(/^diff --git a\/(.+?) b\//m);
  if (!m) return '';
  const ext = m[1].split('.').pop()?.toLowerCase() || '';
  return EXT_TO_LANG[ext] || '';
}

function highlightLine(code: string, lang: string): string {
  if (!lang) return escapeHtml(code);
  try {
    return hljs.highlight(code, { language: lang }).value;
  } catch {
    return escapeHtml(code);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

interface Props {
  accessToken: string;
  workspaceId: string;
  connectionId: string;
  branches: { name: string }[];
  currentBranch: string;
  onClose: () => void;
}

interface DiffFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

interface ConflictFile {
  filename: string;
  baseContent: string;
  headContent: string;
  resolved: string;
  basePatch?: string;
  headPatch?: string;
}

export default function BranchDiff({ accessToken, workspaceId, connectionId, branches, currentBranch, onClose }: Props) {
  const [base, setBase] = useState(currentBranch || branches[0]?.name || 'main');
  const [head, setHead] = useState(branches.find(b => b.name !== base)?.name || branches[1]?.name || '');
  const [diff, setDiff] = useState<DiffFile[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<DiffFile | null>(null);
  const [draggingFile, setDraggingFile] = useState<DiffFile | null>(null);
  const [stagedFiles, setStagedFiles] = useState<DiffFile[]>([]);
  const [conflict, setConflict] = useState<ConflictFile | null>(null);
  const [mergeMsg, setMergeMsg] = useState<string>('');
  const [patchDraft, setPatchDraft] = useState('');
  const [patchMode, setPatchMode] = useState<'edit' | 'preview'>('edit');
  const [conflictCandidates, setConflictCandidates] = useState<Map<string, DiffFile>>(new Map());
  const [_diffWorker, setDiffWorker] = useState<Worker | null>(null);
  const [showGitCmds, setShowGitCmds] = useState(false);
  const [runFeedback, setRunFeedback] = useState<string | null>(null);

  useEffect(() => {
    const worker = new Worker(new URL('../../../workers/diffWorker.ts', import.meta.url), { type: 'module' });
    setDiffWorker(worker);
    return () => worker.terminate();
  }, []);

  const loadDiff = useCallback(async () => {
    if (!base || !head || base === head) return;
    setLoading(true);
    setError(null);
    setDiff(null);
    setSelectedFile(null);
    setStagedFiles([]);
    setConflictCandidates(new Map());
    try {
      const [result, reverseResult]: any[] = await Promise.all([
        repositoryApi.compare(accessToken, workspaceId, connectionId, base, head).then((r) => (r.status === "completed" ? r.data : { files: [] })),
        repositoryApi.compare(accessToken, workspaceId, connectionId, head, base).then((r) => (r.status === "completed" ? r.data : { files: [] })).catch(() => ({ files: [] })),
      ]);
      const reverseFiles = new Map<string, DiffFile>();
      (reverseResult.files || []).forEach((f: DiffFile) => {
        if (f.status !== 'removed') reverseFiles.set(f.filename, f);
      });
      const forwardFiles = result.files || [];
      const candidates = new Map<string, DiffFile>();
      forwardFiles.forEach((f: DiffFile) => {
        if (f.status !== 'removed' && reverseFiles.has(f.filename)) candidates.set(f.filename, reverseFiles.get(f.filename)!);
      });
      setStatus(result.status || '');
      setConflictCandidates(candidates);
      setDiff(forwardFiles);
    } catch (e: any) {
      setError(e.message || 'Failed to compare branches');
    } finally {
      setLoading(false);
    }
  }, [accessToken, workspaceId, connectionId, base, head]);

  useEffect(() => { loadDiff(); }, [loadDiff]);
  useEffect(() => {
    setPatchDraft(selectedFile?.patch || '');
    setPatchMode('edit');
  }, [selectedFile?.filename, selectedFile?.patch]);

  function onDragStart(f: DiffFile) { setDraggingFile(f); }

  function openConflictEditor(file: DiffFile) {
    Promise.all([
      repositoryApi.fileContent(accessToken, workspaceId, connectionId, file.filename, base).then((r) => (r.status === "completed" ? r.data : '')).catch(() => ''),
      repositoryApi.fileContent(accessToken, workspaceId, connectionId, file.filename, head).then((r) => (r.status === "completed" ? r.data : '')).catch(() => ''),
    ]).then(([baseContent, headContent]: any[]) => {
      setConflict({
        filename: file.filename,
        baseContent: baseContent || '',
        headContent: headContent || '',
        resolved: headContent || '',
        basePatch: conflictCandidates.get(file.filename)?.patch || '',
        headPatch: file.patch || '',
      });
    }).catch(() => {
      setConflict({
        filename: file.filename,
        baseContent: '',
        headContent: '',
        resolved: '',
        basePatch: conflictCandidates.get(file.filename)?.patch || '',
        headPatch: file.patch || '',
      });
    });
  }

  function onDropToStage(e: React.DragEvent) {
    e.preventDefault();
    if (!draggingFile) return;
    if (conflictCandidates.has(draggingFile.filename)) {
      openConflictEditor(draggingFile);
    } else {
      setStagedFiles(prev => prev.find(f => f.filename === draggingFile.filename) ? prev : [...prev, draggingFile]);
    }
    setDraggingFile(null);
  }

  function onDropToUnstage(e: React.DragEvent) {
    e.preventDefault();
    if (!draggingFile) return;
    setStagedFiles(prev => prev.filter(f => f.filename !== draggingFile.filename));
    setDraggingFile(null);
  }

  function resolveConflict() {
    if (!conflict) return;
    const resolved: DiffFile = { filename: conflict.filename, status: 'modified', additions: 0, deletions: 0, patch: conflict.resolved };
    setStagedFiles(prev => [...prev.filter(f => f.filename !== conflict.filename), resolved]);
    setConflict(null);
  }

  function savePatchDraft() {
    if (!selectedFile) return;
    const updated = { ...selectedFile, patch: patchDraft };
    setSelectedFile(updated);
    setDiff(prev => prev ? prev.map(f => f.filename === updated.filename ? updated : f) : prev);
    setStagedFiles(prev => prev.map(f => f.filename === updated.filename ? updated : f));
    setPatchMode('preview');
  }

  const statusColor = (s: string) => s === 'added' ? '#00ff9d' : s === 'removed' ? '#ff5f5f' : s === 'renamed' ? '#a78bfa' : '#4d9fff';
  const statusLabel = (s: string) => ({ added: 'A', removed: 'D', modified: 'M', renamed: 'R', copied: 'C' } as any)[s] || '?';
  const mainConflict = diff?.find(f => conflictCandidates.has(f.filename)) || null;

  const overlayStyle: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' };
  const panelStyle: React.CSSProperties = { width: '92vw', height: '88vh', background: 'var(--bg-secondary, #0f172a)', border: '1px solid var(--border-glass, rgba(255,255,255,0.1))', borderRadius: 14, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', boxShadow: '0 28px 90px rgba(0,0,0,0.55)' };
  const colStyle: React.CSSProperties = { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, background: 'rgba(0,0,0,0.2)' };
  const colHeader: React.CSSProperties = { padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-secondary, #94a3b8)', borderBottom: '1px solid rgba(255,255,255,0.07)', letterSpacing: '0.5px', textTransform: 'uppercase' };
  const patchLines = patchDraft.split('\n');

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary, #e2e8f0)' }}>⎇ Branch Diff &amp; Merge</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 16 }}>
            <select value={base} onChange={e => setBase(e.target.value)} style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}>
              {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
            </select>
            <span style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: 12 }}>←→</span>
            <select value={head} onChange={e => setHead(e.target.value)} style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.15)', color: 'white', borderRadius: 6, padding: '4px 8px', fontSize: 12 }}>
              {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
            </select>
            <button onClick={loadDiff} style={{ padding: '4px 10px', fontSize: 11, borderRadius: 5, border: '1px solid rgba(77,159,255,0.4)', background: 'rgba(77,159,255,0.12)', color: '#4d9fff', cursor: 'pointer' }}>Compare</button>
          </div>
          {status && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: status === 'diverged' ? 'rgba(255,95,95,0.15)' : 'rgba(0,255,157,0.1)', color: status === 'diverged' ? '#ff5f5f' : '#00ff9d', border: `1px solid ${status === 'diverged' ? 'rgba(255,95,95,0.3)' : 'rgba(0,255,157,0.2)'}` }}>{status}</span>}
          {conflictCandidates.size > 0 && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,95,95,0.12)', color: '#ff8a8a', border: '1px solid rgba(255,95,95,0.3)' }}>{conflictCandidates.size} file conflict{conflictCandidates.size !== 1 ? 's' : ''}</span>}
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', gap: 12, padding: 14, minHeight: 0 }}>
          {/* Left: changed files on head */}
          <div style={colStyle}>
            <div style={colHeader}>{head || '—'} changes ({diff?.length ?? 0} files) — drag to stage →</div>
            {mainConflict && (
              <div style={{ margin: 8, padding: '9px 10px', borderRadius: 8, border: '1px solid rgba(255,95,95,0.28)', background: 'rgba(255,95,95,0.08)' }}>
                <div style={{ color: '#ff8a8a', fontSize: 11, fontWeight: 800, marginBottom: 4 }}>Main conflict</div>
                <div style={{ color: 'var(--text-primary, #e2e8f0)', fontSize: 11, fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }} title={mainConflict.filename}>{mainConflict.filename}</div>
                <button onClick={() => openConflictEditor(mainConflict)} style={{ marginTop: 8, width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(255,95,95,0.32)', background: 'rgba(255,95,95,0.12)', color: '#ff8a8a', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Open conflict editor</button>
              </div>
            )}
            <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
              {loading && <div style={{ color: 'var(--text-secondary)', fontSize: 12, padding: 12, textAlign: 'center' }}>Loading diff…</div>}
              {error && <div style={{ color: '#ff5f5f', fontSize: 12, padding: 12 }}>{error}</div>}
              {diff?.map(f => (
                <div
                  key={f.filename}
                  draggable
                  onDragStart={() => onDragStart(f)}
                  onClick={() => setSelectedFile(selectedFile?.filename === f.filename ? null : f)}
                  style={{ padding: '6px 10px', borderRadius: 6, marginBottom: 4, cursor: 'grab', background: selectedFile?.filename === f.filename ? 'rgba(77,159,255,0.12)' : 'rgba(255,255,255,0.03)', border: `1px solid ${selectedFile?.filename === f.filename ? 'rgba(77,159,255,0.3)' : 'rgba(255,255,255,0.06)'}`, display: 'flex', alignItems: 'center', gap: 8, userSelect: 'none' }}
                >
                  <span style={{ width: 16, textAlign: 'center', fontWeight: 700, color: statusColor(f.status), fontSize: 10 }}>{statusLabel(f.status)}</span>
                  <span style={{ flex: 1, fontSize: 11, color: 'var(--text-primary, #e2e8f0)', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.filename}</span>
                  {conflictCandidates.has(f.filename) && <button onClick={(e) => { e.stopPropagation(); openConflictEditor(f); }} style={{ fontSize: 10, color: '#ff8a8a', background: 'rgba(255,95,95,0.1)', border: '1px solid rgba(255,95,95,0.25)', borderRadius: 4, padding: '2px 5px', cursor: 'pointer' }}>conflict</button>}
                  <span style={{ fontSize: 10, color: '#00ff9d' }}>+{f.additions}</span>
                  <span style={{ fontSize: 10, color: '#ff5f5f' }}>-{f.deletions}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Center: staged drop zone */}
          <div style={{ width: 220, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={onDropToStage}
              style={{ flex: 1, border: '2px dashed rgba(167,139,250,0.35)', borderRadius: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'rgba(167,139,250,0.04)' }}
            >
              <div style={{ ...colHeader, borderBottom: '1px solid rgba(167,139,250,0.15)', color: '#a78bfa' }}>Staged ({stagedFiles.length})</div>
              <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}
                onDragOver={e => e.preventDefault()}
                onDrop={onDropToUnstage}
              >
                {stagedFiles.length === 0 && <div style={{ color: 'rgba(167,139,250,0.4)', fontSize: 11, textAlign: 'center', marginTop: 20 }}>Drop files here to stage for merge</div>}
                {stagedFiles.map(f => (
                  <div key={f.filename} draggable onDragStart={() => onDragStart(f)}
                    style={{ padding: '5px 8px', borderRadius: 5, marginBottom: 3, background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.2)', fontSize: 10, fontFamily: 'monospace', color: '#a78bfa', cursor: 'grab', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span>✓</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.filename.split('/').pop()}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input value={mergeMsg} onChange={e => setMergeMsg(e.target.value)} placeholder="Merge commit message…" style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: 11, fontFamily: 'inherit' }} />
              <button
                disabled={stagedFiles.length === 0}
                onClick={() => alert('Merge is a read-only preview — push via your git client with the staged changes listed above.')}
                style={{ padding: '8px', borderRadius: 7, border: 'none', background: stagedFiles.length > 0 ? 'rgba(167,139,250,0.8)' : 'rgba(167,139,250,0.2)', color: stagedFiles.length > 0 ? 'white' : 'rgba(255,255,255,0.3)', cursor: stagedFiles.length > 0 ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 600 }}>
                ⎇ Preview Merge ({stagedFiles.length})
              </button>
            </div>
            {/* Git Commands panel */}
            <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
              <button
                onClick={() => setShowGitCmds(g => !g)}
                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer', width: '100%' }}
              >
                {showGitCmds ? '▾' : '▸'} Git Commands
              </button>
              {showGitCmds && (
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    { label: 'Fetch', cmd: `git fetch origin` },
                    { label: 'Pull', cmd: `git pull origin ${base}` },
                    { label: 'Checkout head', cmd: `git checkout ${head}` },
                    { label: 'Merge base into head', cmd: `git merge ${base}` },
                    { label: 'Commit', cmd: `git commit -m "${mergeMsg || 'Merge ' + base + ' into ' + head}"` },
                    { label: 'Push', cmd: `git push origin ${head}` },
                  ].map(({ label, cmd }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#64748b', fontSize: 10, width: 90, flexShrink: 0 }}>{label}</span>
                      <code style={{ flex: 1, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '3px 7px', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#a5f3fc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cmd}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(cmd).catch(() => {});
                          setRunFeedback(label);
                          setTimeout(() => setRunFeedback(null), 2000);
                        }}
                        style={{
                          background: runFeedback === label ? 'rgba(0,255,157,0.15)' : 'rgba(255,255,255,0.05)',
                          border: '1px solid ' + (runFeedback === label ? 'rgba(0,255,157,0.4)' : 'rgba(255,255,255,0.1)'),
                          borderRadius: 4,
                          color: runFeedback === label ? '#00ff9d' : '#94a3b8',
                          cursor: 'pointer',
                          fontSize: 10,
                          padding: '2px 8px',
                          flexShrink: 0,
                          transition: 'all 0.2s',
                        }}
                        title="Copy to clipboard"
                      >
                        {runFeedback === label ? '✓ Copied' : 'Run'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: base branch */}
          <div style={colStyle}>
            <div style={colHeader}>{base} (base)</div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 8, color: 'var(--text-secondary, #94a3b8)', fontSize: 11 }}>
              {diff?.map(f => (
                <div key={f.filename} style={{ padding: '6px 10px', borderRadius: 6, marginBottom: 4, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{f.filename}</span>
                  {f.status === 'added' && <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)' }}>not on base</span>}
                  {f.status === 'removed' && <span style={{ fontSize: 10, color: '#ff5f5f' }}>will be deleted</span>}
                </div>
              ))}
              {!loading && !diff && <div style={{ textAlign: 'center', marginTop: 20 }}>Select branches and click Compare</div>}
            </div>
          </div>
        </div>

        {/* File diff popup */}
        {selectedFile?.patch && (
          <div
            onClick={() => setSelectedFile(null)}
            style={{ position: 'absolute', inset: 0, zIndex: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'rgba(3,7,18,0.72)', backdropFilter: 'blur(6px)' }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ width: 'min(980px, 92%)', height: 'min(680px, 82%)', display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 14, border: '1px solid rgba(0,255,157,0.24)', background: 'linear-gradient(180deg, rgba(15,23,42,0.98), rgba(5,10,18,0.98))', boxShadow: '0 24px 80px rgba(0,0,0,0.62), 0 0 0 1px rgba(255,255,255,0.04)' }}
            >
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.025)' }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,255,157,0.1)', border: '1px solid rgba(0,255,157,0.25)', color: '#00ff9d', fontWeight: 800, fontSize: 12 }}>
                  {statusLabel(selectedFile.status)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ color: 'var(--text-primary, #e2e8f0)', fontSize: 13, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }} title={selectedFile.filename}>
                    {selectedFile.filename}
                  </div>
                  <div style={{ color: 'var(--text-secondary, #94a3b8)', fontSize: 11, marginTop: 3 }}>
                    {base} {'->'} {head}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>
                  <span style={{ color: '#00ff9d', padding: '3px 8px', borderRadius: 999, background: 'rgba(0,255,157,0.08)', border: '1px solid rgba(0,255,157,0.18)' }}>+{selectedFile.additions}</span>
                  <span style={{ color: '#ff5f5f', padding: '3px 8px', borderRadius: 999, background: 'rgba(255,95,95,0.08)', border: '1px solid rgba(255,95,95,0.18)' }}>-{selectedFile.deletions}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setPatchMode('edit')} style={{ padding: '6px 10px', borderRadius: 7, border: patchMode === 'edit' ? '1px solid rgba(0,255,157,0.36)' : '1px solid rgba(255,255,255,0.08)', background: patchMode === 'edit' ? 'rgba(0,255,157,0.1)' : 'rgba(255,255,255,0.04)', color: patchMode === 'edit' ? '#00ff9d' : 'var(--text-secondary, #94a3b8)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Edit</button>
                  <button onClick={savePatchDraft} style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid rgba(77,159,255,0.32)', background: 'rgba(77,159,255,0.1)', color: '#4d9fff', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Save</button>
                  <button onClick={() => setPatchMode('preview')} style={{ padding: '6px 10px', borderRadius: 7, border: patchMode === 'preview' ? '1px solid rgba(167,139,250,0.36)' : '1px solid rgba(255,255,255,0.08)', background: patchMode === 'preview' ? 'rgba(167,139,250,0.12)' : 'rgba(255,255,255,0.04)', color: patchMode === 'preview' ? '#a78bfa' : 'var(--text-secondary, #94a3b8)', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Preview</button>
                </div>
                <button onClick={() => setSelectedFile(null)} style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
              </div>
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '12px 0', background: 'rgba(0,0,0,0.28)' }}>
                {patchMode === 'edit' ? (
                  <textarea
                    value={patchDraft}
                    onChange={e => setPatchDraft(e.target.value)}
                    spellCheck={false}
                    style={{ width: '100%', height: '100%', minHeight: 0, boxSizing: 'border-box', resize: 'none', border: 'none', outline: 'none', background: 'transparent', color: '#22f7a7', padding: '4px 16px 16px', fontFamily: 'JetBrains Mono, Consolas, monospace', fontSize: 11, lineHeight: 1.55, whiteSpace: 'pre', overflowWrap: 'normal', tabSize: 2 }}
                  />
                ) : (
                <div style={{ minWidth: 720, fontFamily: 'JetBrains Mono, Consolas, monospace', fontSize: 11, lineHeight: 1.55 }}>
                  {(() => { const diffLang = detectLang(patchDraft); return patchLines.map((line, i) => {
                    const isAdd = line.startsWith('+') && !line.startsWith('+++');
                    const isDel = line.startsWith('-') && !line.startsWith('---');
                    const isMeta = line.startsWith('@') || line.startsWith('diff ') || line.startsWith('index ') || line.startsWith('---') || line.startsWith('+++');
                    return (
                      <div
                        key={i}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '58px 1fr',
                          color: isAdd ? '#22f7a7' : isDel ? '#ff7b8a' : isMeta ? '#b892ff' : 'var(--text-secondary, #94a3b8)',
                          background: isAdd ? 'rgba(0,255,157,0.08)' : isDel ? 'rgba(255,95,95,0.075)' : isMeta ? 'rgba(167,139,250,0.08)' : 'transparent',
                          borderLeft: isAdd ? '2px solid rgba(0,255,157,0.55)' : isDel ? '2px solid rgba(255,95,95,0.5)' : isMeta ? '2px solid rgba(167,139,250,0.45)' : '2px solid transparent',
                        }}
                      >
                        <span style={{ color: 'rgba(148,163,184,0.45)', textAlign: 'right', padding: '0 10px', userSelect: 'none' }}>{i + 1}</span>
                        <span
                          style={{ whiteSpace: 'pre', paddingRight: 16 }}
                          dangerouslySetInnerHTML={{
                            __html: highlightLine(
                              line.replace(/^[+\- ]/, ''),
                              isMeta ? '' : diffLang
                            ) || ' '
                          }}
                        />
                      </div>
                    );
                  }); })()}
                </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Conflict resolution modal */}
        {conflict && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
            <div style={{ width: '88vw', height: '80vh', background: '#0f172a', border: '2px solid rgba(255,95,95,0.5)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 32px 100px rgba(0,0,0,0.7)' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,95,95,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: '#ff5f5f', fontWeight: 700 }}>⚠ Conflict editor: {conflict.filename}</span>
                <button onClick={() => setConflict(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18 }}>×</button>
              </div>
              {(conflict.basePatch || conflict.headPatch) && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid rgba(255,255,255,0.07)', maxHeight: 150, overflow: 'hidden' }}>
                  <pre style={{ margin: 0, padding: 10, overflow: 'auto', color: '#ffb4b4', background: 'rgba(255,95,95,0.06)', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap' }}>{conflict.basePatch || 'No base-side patch available'}</pre>
                  <pre style={{ margin: 0, padding: 10, overflow: 'auto', color: '#bca7ff', background: 'rgba(167,139,250,0.06)', fontSize: 10, fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'pre-wrap' }}>{conflict.headPatch || 'No head-side patch available'}</pre>
                </div>
              )}
              <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ padding: '6px 12px', fontSize: 10, color: '#94a3b8', background: 'rgba(255,95,95,0.05)' }}>BASE ({base})</div>
                  <textarea readOnly value={conflict.baseContent} style={{ flex: 1, background: 'transparent', border: 'none', color: '#94a3b8', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, padding: 10, resize: 'none', outline: 'none' }} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ padding: '6px 12px', fontSize: 10, color: '#a78bfa', background: 'rgba(167,139,250,0.05)' }}>HEAD ({head})</div>
                  <textarea readOnly value={conflict.headContent} style={{ flex: 1, background: 'transparent', border: 'none', color: '#a78bfa', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, padding: 10, resize: 'none', outline: 'none' }} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '6px 12px', fontSize: 10, color: '#00ff9d', background: 'rgba(0,255,157,0.05)' }}>RESOLVED (edit below)</div>
                  <textarea value={conflict.resolved} onChange={e => setConflict(c => c ? { ...c, resolved: e.target.value } : c)} style={{ flex: 1, background: 'transparent', border: 'none', color: '#00ff9d', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, padding: 10, resize: 'none', outline: 'none' }} />
                </div>
              </div>
              <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button onClick={() => setConflict(null)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>Cancel</button>
                <button onClick={resolveConflict} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#00ff9d', color: '#0f172a', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>✓ Accept Resolution</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
