import React, { useState, useEffect } from 'react';
import { toMermaid, toPlantUML, toSVG, toShareLink } from '../services/exporters';
import type { GraphNode, GraphEdge, FilterState } from '../services/exporters';

interface ExportModalProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  svgRef: React.RefObject<SVGElement | null>;
  repoUrl: string;
  filterState: FilterState;
  onClose: () => void;
}

type ExportTab = 'mermaid' | 'plantuml' | 'svg' | 'sharelink';

export default function ExportModal({ nodes, edges, svgRef, repoUrl, filterState, onClose }: ExportModalProps) {
  const [activeTab, setActiveTab] = useState<ExportTab>('mermaid');
  const [copied, setCopied] = useState(false);
  const [svgPreviewUrl, setSvgPreviewUrl] = useState<string>('');

  const mermaidText = toMermaid(nodes, edges);
  const plantumlText = toPlantUML(nodes, edges);
  const shareLink = toShareLink(repoUrl, filterState);

  useEffect(() => {
    if (activeTab === 'svg' && svgRef.current) {
      const svgStr = toSVG(svgRef.current as SVGElement);
      const blob = new Blob([svgStr], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      setSvgPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [activeTab, svgRef]);

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownloadSVG() {
    if (!svgRef.current) return;
    const svgStr = toSVG(svgRef.current as SVGElement);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'codeflow-graph.svg';
    a.click();
    URL.revokeObjectURL(url);
  }

  const tabs: { id: ExportTab; label: string }[] = [
    { id: 'mermaid', label: 'Mermaid' },
    { id: 'plantuml', label: 'PlantUML' },
    { id: 'svg', label: 'SVG' },
    { id: 'sharelink', label: 'Share Link' },
  ];

  const activeContent: Record<ExportTab, string> = {
    mermaid: mermaidText,
    plantuml: plantumlText,
    svg: '',
    sharelink: shareLink,
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#161b22',
          border: '1px solid #30363d',
          borderRadius: '12px',
          width: '640px',
          maxWidth: '95vw',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #30363d' }}>
          <span style={{ color: '#f0f6fc', fontWeight: 700, fontSize: '1rem' }}>Export / Share</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#8b949e', cursor: 'pointer', fontSize: '1.2rem', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', padding: '12px 20px 0', borderBottom: '1px solid #30363d' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setCopied(false); }}
              style={{
                background: activeTab === tab.id ? '#21262d' : 'transparent',
                border: activeTab === tab.id ? '1px solid #30363d' : '1px solid transparent',
                borderBottom: 'none',
                color: activeTab === tab.id ? '#f0f6fc' : '#8b949e',
                borderRadius: '6px 6px 0 0',
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: activeTab === tab.id ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
          {activeTab === 'svg' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {svgPreviewUrl && (
                <img
                  src={svgPreviewUrl}
                  alt="Graph preview"
                  style={{ width: '100%', border: '1px solid #30363d', borderRadius: '8px', background: '#0d1117', maxHeight: '300px', objectFit: 'contain' }}
                />
              )}
              <button
                onClick={handleDownloadSVG}
                style={{ background: '#238636', border: 'none', color: 'white', padding: '8px 18px', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}
              >
                Download SVG
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {activeTab === 'sharelink' && (
                <p style={{ color: '#8b949e', fontSize: '0.8rem', margin: 0 }}>
                  Share this link to let others open CodeFlow with the same repository pre-loaded.
                </p>
              )}
              {activeTab === 'mermaid' && (
                <p style={{ color: '#8b949e', fontSize: '0.8rem', margin: 0 }}>
                  Paste into GitHub markdown, Notion, or{' '}
                  <a href="https://mermaid.live" target="_blank" rel="noreferrer" style={{ color: '#58a6ff' }}>mermaid.live</a>.
                </p>
              )}
              {activeTab === 'plantuml' && (
                <p style={{ color: '#8b949e', fontSize: '0.8rem', margin: 0 }}>
                  Paste into Confluence, Jira, or{' '}
                  <a href="https://www.plantuml.com/plantuml/uml/" target="_blank" rel="noreferrer" style={{ color: '#58a6ff' }}>plantuml.com</a>.
                </p>
              )}
              <textarea
                readOnly
                value={activeContent[activeTab]}
                style={{
                  background: '#0d1117',
                  border: '1px solid #30363d',
                  borderRadius: '8px',
                  color: '#c9d1d9',
                  fontFamily: 'monospace',
                  fontSize: '0.78rem',
                  padding: '12px',
                  resize: 'vertical',
                  minHeight: '220px',
                  outline: 'none',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              />
              <button
                onClick={() => handleCopy(activeContent[activeTab])}
                style={{
                  background: copied ? '#1a2b1a' : '#21262d',
                  border: `1px solid ${copied ? '#238636' : '#30363d'}`,
                  color: copied ? '#3fb950' : '#f0f6fc',
                  padding: '7px 16px',
                  borderRadius: '6px',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  alignSelf: 'flex-start',
                  transition: 'all 0.15s',
                }}
              >
                {copied ? '✓ Copied!' : 'Copy to clipboard'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
