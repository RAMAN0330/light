// Ported (not rewritten) from CodeGraph's github.ts: the pure, computational
// half of that file — dependency-graph assembly, blast radius, health score.
// The GitHub-fetching half is deliberately NOT ported: Orbital fetches repo
// data server-side (see ../../api/repositories.ts) so tokens never reach the
// browser, unlike CodeGraph's original browser-direct design.
import { Parser } from "./parser";

export type RepoFile = { path: string; name: string; folder: string; content?: string };
export type FnDef = { name: string; file: string; folder?: string; line?: number; [key: string]: unknown };
export type Connection = { source: string; target: string; fn: string; count: number };

export function buildTree(files: { path: string; folder: string; [key: string]: unknown }[]) {
  const root: any = { name: "root", path: "", children: {}, files: [] };
  files.forEach((f) => {
    const parts = f.folder && f.folder !== "root" ? f.folder.split("/") : [];
    let cur = root;
    parts.forEach((p, i) => {
      const path = parts.slice(0, i + 1).join("/");
      if (!cur.children[p]) cur.children[p] = { name: p, path, children: {}, files: [] };
      cur = cur.children[p];
    });
    cur.files.push(f);
  });
  return root;
}

/** Assembles the function/dependency graph the same way CodeGraph's LegacyWorkspaceEngine
 * does (allFns tagged per-file, then Parser.findCalls per file against candidate names),
 * just without that file's progress-UI/batching ceremony. */
export function buildAnalysis(files: RepoFile[]): { functions: FnDef[]; connections: Connection[] } {
  const codeFiles = files.filter((f) => f.content && Parser.isCode(f.name));
  const allFns: FnDef[] = [];
  codeFiles.forEach((file) => {
    const extracted = Parser.extract(file.content!, file.path) as any[];
    extracted.forEach((fn) => allFns.push({ ...fn, file: file.path, folder: file.folder }));
  });
  const fnNames = [...new Set(allFns.map((f) => f.name))];
  const connections: Connection[] = [];
  const firstDefFile = new Map<string, string>();
  allFns.forEach((fn) => {
    if (!firstDefFile.has(fn.name)) firstDefFile.set(fn.name, fn.file);
  });
  codeFiles.forEach((file) => {
    const tokenSet = new Set(file.content!.match(/\b[A-Za-z_$]\w*\b/g) || []);
    const candidateFnNames = fnNames.filter((fn) => tokenSet.has(fn) || tokenSet.has(String(fn).split(".").pop()!));
    if (!candidateFnNames.length) return;
    const calls = Parser.findCalls(file.content!, candidateFnNames, file.path, allFns) as Record<string, number>;
    Object.entries(calls).forEach(([fn, count]) => {
      if (count <= 0) return;
      const def = firstDefFile.get(fn);
      if (def && def !== file.path) connections.push({ source: def, target: file.path, fn, count });
    });
  });
  return { functions: allFns, connections };
}

export function calcBlast(fileId: string, connections: Connection[], files: { path: string }[]) {
  const exportedTo: Record<string, Set<string>> = {};
  const importedFrom: Record<string, Set<string>> = {};
  const exportedFns: Record<string, Map<string, number>> = {};
  connections.forEach((c) => {
    const src = c.source;
    const tgt = c.target;
    if (!exportedTo[src]) exportedTo[src] = new Set();
    exportedTo[src].add(tgt);
    if (!importedFrom[tgt]) importedFrom[tgt] = new Set();
    importedFrom[tgt].add(src);
    if (!exportedFns[src]) exportedFns[src] = new Map();
    const fnMap = exportedFns[src];
    fnMap.set(c.fn, (fnMap.get(c.fn) || 0) + (c.count || 1));
  });
  const directDeps = exportedTo[fileId] ? Array.from(exportedTo[fileId]) : [];
  const transitive = new Map<string, number>();
  let queue = directDeps.map((f) => ({ file: f, depth: 1 }));
  const visited = new Set([fileId, ...directDeps]);
  while (queue.length > 0) {
    const item = queue.shift()!;
    if (item.depth > 3) continue;
    transitive.set(item.file, item.depth);
    const nextDeps = exportedTo[item.file] || new Set<string>();
    nextDeps.forEach((f) => {
      if (!visited.has(f)) {
        visited.add(f);
        queue.push({ file: f, depth: item.depth + 1 });
      }
    });
  }
  const fnUsage = exportedFns[fileId] || new Map<string, number>();
  const fnsUsed = fnUsage.size;
  let totalCalls = 0;
  fnUsage.forEach((cnt) => (totalCalls += cnt));
  const dependencies = importedFrom[fileId] ? Array.from(importedFrom[fileId]) : [];
  let impactScore = directDeps.length;
  transitive.forEach((depth) => {
    if (depth > 1) impactScore += 1 / depth;
  });
  const centrality = directDeps.length + dependencies.length + fnsUsed;
  const connectedFiles = files.filter((f) => exportedTo[f.path] || importedFrom[f.path]).length;
  const relativePct = connectedFiles > 0 ? Math.round((directDeps.length / connectedFiles) * 100) : 0;
  let level = "low";
  if (directDeps.length >= 8 || fnsUsed >= 5) level = "critical";
  else if (directDeps.length >= 4 || fnsUsed >= 3) level = "high";
  else if (directDeps.length >= 2 || fnsUsed >= 1) level = "medium";
  return {
    affected: directDeps,
    transitive: Array.from(transitive.keys()),
    count: directDeps.length,
    transitiveCount: transitive.size,
    percent: relativePct,
    level,
    depth: transitive.size > 0 ? Math.max(...Array.from(transitive.values())) : 0,
    fnsUsed,
    totalCalls,
    dependencies,
    impactScore: Math.round(impactScore * 10) / 10,
    centrality,
  };
}

export type Issue = { title: string; detail: string };
export type SecurityIssue = { severity: "high" | "medium" | "low"; title: string; file: string; path: string; line?: number; desc: string; code: string };

/** Circular-dependency + god-file detection, built from buildAnalysis's own output
 * (not Parser.detectPatterns, whose pattern names don't match what calcHealth checks
 * for — this uses the same >15-function "large file" threshold Parser.detectPatterns
 * uses, just with titles calcHealth's `.title.includes('Large'|'Circular')` checks match). */
export function detectIssues(files: RepoFile[], functions: FnDef[], connections: Connection[]): Issue[] {
  const issues: Issue[] = [];
  const seenPairs = new Set<string>();
  connections.forEach((c) => {
    const reverseKey = `${c.target}=>${c.source}`;
    const forwardKey = `${c.source}=>${c.target}`;
    if (seenPairs.has(reverseKey) || seenPairs.has(forwardKey)) return;
    const hasReverse = connections.some((other) => other.source === c.target && other.target === c.source);
    if (hasReverse) {
      seenPairs.add(forwardKey);
      issues.push({ title: `Circular dependency: ${c.source} ↔ ${c.target}`, detail: "These files depend on each other — consider extracting the shared piece." });
    }
  });
  const fnCountByFile = new Map<string, number>();
  functions.forEach((fn) => fnCountByFile.set(fn.file, (fnCountByFile.get(fn.file) || 0) + 1));
  files.forEach((f) => {
    const count = fnCountByFile.get(f.path) || 0;
    if (count > 15) issues.push({ title: `Large file: ${f.name} (${count} functions)`, detail: "Consider splitting into smaller modules." });
  });
  return issues;
}

export type HealthInput = {
  stats: { functions: number; dead: number; files: number; connections: number };
  issues: { title: string }[];
  securityIssues?: { severity: string }[];
};

export function calcHealth(data: HealthInput | null) {
  if (!data) return { score: 0, grade: "F" };
  let score = 100;
  const deadPct = data.stats.functions > 0 ? (data.stats.dead / data.stats.functions) * 100 : 0;
  score -= Math.min(20, deadPct);
  const circular = data.issues.filter((i) => i.title.includes("Circular")).length;
  score -= Math.min(20, circular * 5);
  const god = data.issues.filter((i) => i.title.includes("Large")).length;
  score -= Math.min(15, god * 3);
  const avgCoup = data.stats.files > 0 ? data.stats.connections / data.stats.files : 0;
  score -= Math.min(15, Math.max(0, avgCoup - 3) * 2);
  const sec = data.securityIssues ? data.securityIssues.filter((i) => i.severity === "high").length : 0;
  score -= Math.min(20, sec * 5);
  score = Math.max(0, Math.round(score));
  let grade = "F";
  if (score >= 90) grade = "A";
  else if (score >= 80) grade = "B";
  else if (score >= 70) grade = "C";
  else if (score >= 60) grade = "D";
  return { score, grade };
}
