export interface GraphifyPayload {
  nodes?: Record<string, any>[];
  links?: Record<string, any>[];
  hyperedges?: Record<string, any>[];
  built_at_commit?: string;
}

export function adaptGraphifyGraph(payload: GraphifyPayload) {
  const rawNodes = (payload?.nodes || []).filter(node => typeof node?.id === 'string' && node.id);
  const ids = new Set(rawNodes.map(node => node.id));
  const rawLinks = (payload?.links || []).filter(link => ids.has(link?.source) && ids.has(link?.target));
  const degrees = new Map<string, { incoming: number; outgoing: number }>();
  rawNodes.forEach(node => degrees.set(node.id, { incoming: 0, outgoing: 0 }));
  rawLinks.forEach(link => {
    degrees.get(link.source)!.outgoing++;
    degrees.get(link.target)!.incoming++;
  });

  const nodes = rawNodes.map(node => {
    const degree = degrees.get(node.id)!;
    const communityName = node.community_name || `Community ${node.community ?? 'unknown'}`;
    const line = Number(String(node.source_location || '').match(/\d+/)?.[0] || 0);
    return {
      id: node.id,
      name: node.label || node.id,
      folder: communityName,
      fnCount: degree.outgoing,
      layer: node.file_type || 'code',
      churn: 0,
      sourceFile: node.source_file || '',
      sourceLocation: node.source_location || '',
      line,
      fileType: node.file_type || 'code',
      community: node.community,
      communityName,
      degree: degree.incoming + degree.outgoing,
      incoming: degree.incoming,
      outgoing: degree.outgoing,
    };
  });

  const links = rawLinks.map(link => ({
    source: link.source,
    target: link.target,
    count: 1,
    fn: link.relation || link.relationship || link.type || '',
    relationship: link.relation || link.relationship || link.type || 'related',
    confidence: link.confidence || 'EXTRACTED',
    confidenceScore: Number(link.confidence_score ?? link.weight ?? 1),
    sourceFile: link.source_file || '',
    sourceLocation: link.source_location || '',
  }));

  return { nodes, links, builtAtCommit: payload.built_at_commit || '' };
}
