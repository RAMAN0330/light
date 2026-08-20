export interface ManifestPackage {
  name: string;
  version: string;
  ecosystem: string; // "npm" | "PyPI" | "Go" | "RubyGems"
}

export interface VulnResult {
  pkg: string;
  version: string;
  ecosystem: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';
  cveId: string;
  summary: string;
  url: string;
}

const SEVERITY_ORDER: Record<VulnResult['severity'], number> = {
  CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, UNKNOWN: 4,
};

function cvssToSeverity(vulnObj: any): VulnResult['severity'] {
  const severities: number[] = [];
  for (const s of vulnObj.severity ?? []) {
    if (s.type === 'CVSS_V3' || s.type === 'CVSS_V2') {
      const score = parseFloat(s.score);
      if (!isNaN(score)) severities.push(score);
    }
  }
  if (severities.length === 0) return 'UNKNOWN';
  const max = Math.max(...severities);
  if (max >= 9.0) return 'CRITICAL';
  if (max >= 7.0) return 'HIGH';
  if (max >= 4.0) return 'MEDIUM';
  return 'LOW';
}

function extractCveId(vulnObj: any): string {
  for (const alias of vulnObj.aliases ?? []) {
    if (alias.startsWith('CVE-')) return alias;
  }
  return vulnObj.id ?? '';
}

function extractUrl(vulnObj: any): string {
  for (const ref of vulnObj.references ?? []) {
    if (ref.type === 'ADVISORY' || ref.type === 'WEB') return ref.url ?? '';
  }
  return `https://osv.dev/vulnerability/${vulnObj.id}`;
}

export async function scanDependencies(packages: ManifestPackage[]): Promise<VulnResult[]> {
  if (packages.length === 0) return [];

  const queries = packages.map(p => ({
    package: { name: p.name, ecosystem: p.ecosystem },
    version: p.version,
  }));

  let response: Response;
  try {
    response = await fetch('https://api.osv.dev/v1/querybatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries }),
    });
  } catch {
    return [];
  }

  if (!response.ok) return [];

  const data = await response.json();
  const results: VulnResult[] = [];

  for (let i = 0; i < packages.length; i++) {
    const pkg = packages[i];
    const vulns: any[] = data.results?.[i]?.vulns ?? [];
    for (const v of vulns) {
      results.push({
        pkg: pkg.name,
        version: pkg.version,
        ecosystem: pkg.ecosystem,
        severity: cvssToSeverity(v),
        cveId: extractCveId(v),
        summary: v.summary ?? '',
        url: extractUrl(v),
      });
    }
  }

  results.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return results;
}
