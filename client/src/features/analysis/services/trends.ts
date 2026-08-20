import { repositoryApi } from '../../../api/repositories';
import { calcHealth } from './analysis';
import { Parser } from './parser';

export interface TrendSnapshot {
  sha: string;
  shortSha: string;
  date: string;
  author: string;
  message: string;
  healthScore: number;
  healthGrade: string;
  securityCount: number;
  fileCount: number;
  functionCount: number;
  testRatio: number;
}

export interface ActivityPoint {
  weekLabel: string;
  commitCount: number;
  authorCount: number;
}

const CODE_EXTS = new Set([
  'ts','tsx','js','jsx','py','go','rb','java','cs','cpp','c','rs','swift','kt','php',
]);

function isCodeFile(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return CODE_EXTS.has(ext);
}

function isTestFile(name: string): boolean {
  return /test|spec|__tests__/i.test(name);
}

async function analyseCommit(
  sha: string,
  accessToken: string,
  workspaceId: string,
  connectionId: string,
): Promise<Omit<TrendSnapshot, 'sha' | 'shortSha' | 'date' | 'author' | 'message'> | null> {
  try {
    const treeResult = await repositoryApi.tree(accessToken, workspaceId, connectionId, sha);
    if (treeResult.status !== 'completed') return null;
    const allPaths: string[] = treeResult.data.tree
      .filter((n) => n.type === 'blob' && isCodeFile(n.path))
      .map((n) => n.path);

    const paths = allPaths
      .sort((a, b) => a.split('/').length - b.split('/').length)
      .slice(0, 50);

    const fileObjs = await Promise.all(
      paths.map(async (p) => {
        try {
          const result = await repositoryApi.fileContent(accessToken, workspaceId, connectionId, p, sha);
          const content = result.status === 'completed' ? result.data : null;
          if (!content) return null;
          const name = p.split('/').pop() ?? p;
          const fns = Parser.extract(content, p);
          return { path: p, name, content, functions: fns, lines: content.split('\n').length, layer: Parser.detectLayer(p), isCode: true };
        } catch {
          return null;
        }
      })
    );

    const analyzed = fileObjs.filter(Boolean) as any[];
    if (analyzed.length === 0) return null;

    const allFns = analyzed.flatMap((f: any) => f.functions ?? []);
    const securityIssues = Parser.detectSecurity(analyzed);
    const testFiles = analyzed.filter((f: any) => isTestFile(f.name ?? f.path ?? ''));

    const mini = {
      files: analyzed,
      functions: allFns,
      connections: [],
      issues: [],
      securityIssues,
      stats: {
        files: analyzed.length,
        functions: allFns.length,
        connections: 0,
        dead: 0,
      },
    };

    const health = calcHealth(mini);

    return {
      healthScore: health.score,
      healthGrade: health.grade,
      securityCount: securityIssues.filter((i: any) => i.severity === 'high').length,
      fileCount: analyzed.length,
      functionCount: allFns.length,
      testRatio: analyzed.length > 0
        ? Math.round((testFiles.length / analyzed.length) * 100)
        : 0,
    };
  } catch {
    return null;
  }
}

export async function fetchTrendData(
  commits: any[],
  accessToken: string,
  workspaceId: string,
  connectionId: string,
): Promise<TrendSnapshot[]> {
  const recent = commits.slice(0, 5).reverse();

  const snapshots = await Promise.all(
    recent.map(async (c: any): Promise<TrendSnapshot | null> => {
      const sha: string = c.sha ?? '';
      if (!sha) return null;
      const metrics = await analyseCommit(sha, accessToken, workspaceId, connectionId);
      if (!metrics) return null;
      return {
        sha,
        shortSha: sha.slice(0, 7),
        date: c.commit?.author?.date ?? '',
        author: c.commit?.author?.name ?? '',
        message: (c.commit?.message ?? '').split('\n')[0],
        ...metrics,
      };
    })
  );

  return snapshots.filter(Boolean) as TrendSnapshot[];
}

export function buildActivityPoints(commits: any[]): ActivityPoint[] {
  const byWeek = new Map<string, { commits: number; authors: Set<string> }>();

  for (const c of commits) {
    const date = c.commit?.author?.date;
    if (!date) continue;
    const d = new Date(date);
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + diff);
    const key = monday.toISOString().slice(0, 10);
    if (!byWeek.has(key)) byWeek.set(key, { commits: 0, authors: new Set() });
    const w = byWeek.get(key)!;
    w.commits++;
    const author = c.commit?.author?.name;
    if (author) w.authors.add(author);
  }

  return Array.from(byWeek.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([key, v]) => {
      const d = new Date(key);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return {
        weekLabel: label,
        commitCount: v.commits,
        authorCount: v.authors.size,
      };
    });
}
