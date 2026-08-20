import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Database, GitBranch, GitCommit, GitPullRequest, Network, Plus, Shield, Users } from "lucide-react";
import { EASE_OUT_EXPO, SPRING_SNAPPY } from "../lib/motion";

import { cicdApi, type CiConnection } from "../api/cicd";
import { repositoryApi, type Branch, type CommitSummary, type PullRequestSummary, type TreeEntry } from "../api/repositories";
import { buildAnalysis, buildTree, calcBlast, calcHealth, detectIssues, type Connection, type FnDef } from "../features/analysis/services/analysis";
import { Parser } from "../features/analysis/services/parser";
import { buildActivityPoints, fetchTrendData, type ActivityPoint, type TrendSnapshot } from "../features/analysis/services/trends";
import BlameHeatmap from "../features/git-insights/components/BlameHeatmap";
import BranchDiff from "../features/git-insights/components/BranchDiff";
import CodeOwnershipMap from "../features/git-insights/components/CodeOwnershipMap";
import CommitTimeline from "../features/git-insights/components/CommitTimeline";
import ContributorInsights from "../features/git-insights/components/ContributorInsights";
import ReleaseNotesGenerator from "../features/git-insights/components/ReleaseNotesGenerator";
import VulnerabilityScanner from "../features/security/components/VulnerabilityScanner";
import { extractManifestDependencies } from "../features/security/services/manifestParser";
import { scanDependencies, type VulnResult } from "../features/security/services/osv";
import ExportModal from "../features/export/components/ExportModal";
import { VirtualizedRepoTree } from "../shared/components/VirtualizedRepoTree";
import { GitHubRepoPicker } from "./GitHubRepoPicker";
import { Input, Select } from "./ui/field";

// Lazy-loaded: DatabaseSchemaPanel pulls in reactflow, TrendsPanel pulls in
// d3 — both only needed once someone opens that specific tab. Splits them
// into their own chunks instead of bloating every Repositories page load.
const DatabaseSchemaPanel = lazy(() => import("./DatabaseSchemaPanel").then((m) => ({ default: m.DatabaseSchemaPanel })));
const TrendsPanel = lazy(() => import("./TrendsPanel").then((m) => ({ default: m.TrendsPanel })));
const tabPanelFallback = <div className="repo-workspace-loading">Loading…</div>;

type Tab = "tree" | "commits" | "branches" | "pulls" | "intelligence" | "ownership" | "contributors" | "releases" | "security" | "database" | "trends";

const TABS: { id: Tab; label: string; icon?: React.ReactNode }[] = [
  { id: "tree", label: "Files" },
  { id: "commits", label: "Commits", icon: <GitCommit size={14} /> },
  { id: "branches", label: "Branches", icon: <GitBranch size={14} /> },
  { id: "pulls", label: "Pull requests", icon: <GitPullRequest size={14} /> },
  { id: "ownership", label: "Ownership", icon: <Users size={14} /> },
  { id: "contributors", label: "Contributors", icon: <Users size={14} /> },
  { id: "releases", label: "Releases" },
  { id: "security", label: "Security", icon: <Shield size={14} /> },
  { id: "database", label: "Database", icon: <Database size={14} /> },
  { id: "trends", label: "Trends" },
  { id: "intelligence", label: "Codebase Intelligence", icon: <Network size={14} /> },
];

const MANIFEST_NAMES = new Set(["package.json", "requirements.txt", "go.mod", "Gemfile.lock"]);

const MAX_ANALYZED_FILES = 60;

function gatedMessage(status: string, reason?: string): string {
  if (status === "denied") return reason || "Workspace policy denied this action.";
  if (status === "approval_required") return "This requires workspace approval — check the Approval inbox.";
  if (status === "failed") return reason || "Request failed.";
  return "Unavailable.";
}

export function RepositoryWorkspace({ accessToken, workspaceId }: { accessToken: string; workspaceId: string }) {
  const [connections, setConnections] = useState<CiConnection[]>([]);
  const [connectionId, setConnectionId] = useState("");
  const [externalRef, setExternalRef] = useState("");
  const [branch, setBranch] = useState("");
  const [tab, setTab] = useState<Tab>("tree");
  const [tree, setTree] = useState<TreeEntry[]>([]);
  const [treeError, setTreeError] = useState("");
  const [selectedPath, setSelectedPath] = useState("");
  const [fileContent, setFileContent] = useState("");
  const [commits, setCommits] = useState<CommitSummary[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [pullRequests, setPullRequests] = useState<PullRequestSummary[]>([]);

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState("");
  const [functions, setFunctions] = useState<FnDef[]>([]);
  const [connectionsGraph, setConnectionsGraph] = useState<Connection[]>([]);
  const [analyzedFiles, setAnalyzedFiles] = useState<{ path: string; name: string; folder: string }[]>([]);
  const [selectedBlastPath, setSelectedBlastPath] = useState("");
  const [compareOpen, setCompareOpen] = useState(false);
  const [trendSnapshots, setTrendSnapshots] = useState<TrendSnapshot[]>([]);
  const [activityPoints, setActivityPoints] = useState<ActivityPoint[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const exportSvgRef = useRef<SVGElement | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set([""]));
  const [activeFolderFilter, setActiveFolderFilter] = useState<string | null>(null);
  const [vulns, setVulns] = useState<VulnResult[]>([]);
  const [vulnsLoading, setVulnsLoading] = useState(false);
  const [vulnsError, setVulnsError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    cicdApi.listCiConnections(accessToken, workspaceId).then((items) => {
      setConnections(items);
      setConnectionId((current) => current || items[0]?.id || "");
    }).catch(() => {});
  }, [accessToken, workspaceId]);

  useEffect(() => {
    if (!connectionId) return;
    setTree([]); setTreeError(""); setSelectedPath(""); setFileContent("");
    setFunctions([]); setConnectionsGraph([]); setAnalyzedFiles([]); setSelectedBlastPath("");
    repositoryApi.repoInfo(accessToken, workspaceId, connectionId).then((result) => {
      if (result.status === "completed") setBranch(result.data.default_branch);
    }).catch(() => {});
  }, [accessToken, workspaceId, connectionId]);

  const needsTree = tab === "tree" || tab === "ownership" || tab === "contributors" || tab === "security" || tab === "database";
  useEffect(() => {
    if (!connectionId || !branch || !needsTree || tree.length) return;
    repositoryApi.tree(accessToken, workspaceId, connectionId, branch).then((result) => {
      if (result.status === "completed") setTree(result.data.tree.filter((entry) => entry.type === "blob"));
      else setTreeError(gatedMessage(result.status, "reason" in result ? result.reason : undefined));
    }).catch(() => setTreeError("Could not reach the repository."));
  }, [accessToken, workspaceId, connectionId, branch, needsTree, tree.length]);

  useEffect(() => {
    if (!connectionId || tab !== "security" || !tree.length) return;
    const manifestEntries = tree.filter((entry) => MANIFEST_NAMES.has(entry.path.split("/").pop() || ""));
    if (!manifestEntries.length) return;
    let cancelled = false;
    setVulnsLoading(true);
    setVulnsError(null);
    (async () => {
      try {
        const files = await Promise.all(
          manifestEntries.map(async (entry) => {
            const result = await repositoryApi.fileContent(accessToken, workspaceId, connectionId, entry.path, branch);
            return { name: entry.path.split("/").pop() || entry.path, content: result.status === "completed" ? result.data : undefined };
          }),
        );
        const packages = extractManifestDependencies(files);
        const results = await scanDependencies(packages);
        if (!cancelled) setVulns(results);
      } catch (error: any) {
        if (!cancelled) setVulnsError(error?.message || "Could not scan dependencies.");
      } finally {
        if (!cancelled) setVulnsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [accessToken, workspaceId, connectionId, branch, tab, tree]);

  useEffect(() => {
    if (!connectionId || tab !== "commits") return;
    repositoryApi.commits(accessToken, workspaceId, connectionId, undefined, branch).then((result) => {
      if (result.status === "completed") setCommits(result.data);
    }).catch(() => {});
  }, [accessToken, workspaceId, connectionId, branch, tab]);

  useEffect(() => {
    if (!connectionId || tab !== "branches") return;
    repositoryApi.branches(accessToken, workspaceId, connectionId).then((result) => {
      if (result.status === "completed") setBranches(result.data);
    }).catch(() => {});
  }, [accessToken, workspaceId, connectionId, tab]);

  useEffect(() => {
    if (!connectionId || tab !== "pulls") return;
    repositoryApi.pullRequests(accessToken, workspaceId, connectionId).then((result) => {
      if (result.status === "completed") setPullRequests(result.data);
    }).catch(() => {});
  }, [accessToken, workspaceId, connectionId, tab]);

  async function createConnectionFor(fullName: string) {
    if (!workspaceId || !fullName.trim()) return;
    const connection = await cicdApi.createCiConnection(accessToken, workspaceId, fullName.trim());
    setConnections((items) => [connection, ...items]);
    setConnectionId((current) => current || connection.id);
    setExternalRef("");
  }

  async function createConnection(event: React.FormEvent) {
    event.preventDefault();
    await createConnectionFor(externalRef);
  }

  async function openFile(path: string) {
    setSelectedPath(path);
    setFileContent("Loading…");
    try {
      const result = await repositoryApi.fileContent(accessToken, workspaceId, connectionId, path, branch);
      setFileContent(result.status === "completed" ? result.data : gatedMessage(result.status, "reason" in result ? result.reason : undefined));
    } catch {
      setFileContent("Could not reach the repository.");
    }
  }

  async function loadTrends() {
    if (!connectionId) return;
    setTrendsLoading(true);
    try {
      const commitsResult = await repositoryApi.commits(accessToken, workspaceId, connectionId, undefined, branch, 10);
      const recentCommits = commitsResult.status === "completed" ? commitsResult.data : [];
      setActivityPoints(buildActivityPoints(recentCommits));
      setTrendSnapshots(await fetchTrendData(recentCommits, accessToken, workspaceId, connectionId));
    } finally {
      setTrendsLoading(false);
    }
  }

  async function analyzeRepository() {
    if (!connectionId) return;
    setAnalyzing(true);
    setAnalysisError("");
    try {
      const treeResult = tree.length ? { status: "completed" as const, data: { tree } } : await repositoryApi.tree(accessToken, workspaceId, connectionId, branch);
      if (treeResult.status !== "completed") {
        setAnalysisError(gatedMessage(treeResult.status, "reason" in treeResult ? treeResult.reason : undefined));
        return;
      }
      const candidates = treeResult.data.tree
        .filter((entry) => entry.type === "blob" && Parser.isCode(entry.path))
        .slice(0, MAX_ANALYZED_FILES);
      const files = await Promise.all(
        candidates.map(async (entry) => {
          const name = entry.path.includes("/") ? entry.path.slice(entry.path.lastIndexOf("/") + 1) : entry.path;
          const folder = entry.path.includes("/") ? entry.path.slice(0, entry.path.lastIndexOf("/")) : "root";
          const contentResult = await repositoryApi.fileContent(accessToken, workspaceId, connectionId, entry.path, branch);
          return { path: entry.path, name, folder, content: contentResult.status === "completed" ? contentResult.data : undefined };
        }),
      );
      const { functions: fns, connections: conns } = buildAnalysis(files);
      setFunctions(fns);
      setConnectionsGraph(conns);
      setAnalyzedFiles(files.map(({ path, name, folder }) => ({ path, name, folder })));
      setSelectedBlastPath(files[0]?.path || "");
    } catch {
      setAnalysisError("Could not analyze the repository.");
    } finally {
      setAnalyzing(false);
    }
  }

  const fnCountByFile = new Map<string, number>();
  functions.forEach((fn) => fnCountByFile.set(fn.file, (fnCountByFile.get(fn.file) || 0) + 1));
  const health = analyzedFiles.length
    ? calcHealth({
        stats: { functions: functions.length, dead: 0, files: analyzedFiles.length, connections: connectionsGraph.length },
        issues: detectIssues(analyzedFiles, functions, connectionsGraph),
      })
    : null;
  const issues = analyzedFiles.length ? detectIssues(analyzedFiles, functions, connectionsGraph) : [];
  const blast = selectedBlastPath ? calcBlast(selectedBlastPath, connectionsGraph, analyzedFiles) : null;
  const folderTree = tree.length ? buildTree(tree.map((entry) => ({ ...entry, folder: entry.path.includes("/") ? entry.path.slice(0, entry.path.lastIndexOf("/")) : "root" }))) : null;

  const activeConnection = connections.find((c) => c.id === connectionId);
  const reduceMotion = useReducedMotion();

  return (
    <div className="repo-workspace">
      <header className="repo-workspace-head">
        <div>
          <h1>Repositories</h1>
          <p>Browse commits, branches and pull requests, and run Codebase Intelligence over the repository.</p>
        </div>
        {connections.length > 0 && (
          <Select aria-label="Repository connection" value={connectionId} onChange={(event) => setConnectionId(event.target.value)}>
            {connections.map((connection) => (
              <option key={connection.id} value={connection.id}>{connection.external_ref}</option>
            ))}
          </Select>
        )}
      </header>

      {connections.length === 0 ? (
        <div className="repo-connect-empty">
          <form onSubmit={createConnection} className="repo-connect-form">
            <Input aria-label="GitHub repository (org/repo)" value={externalRef} onChange={(event) => setExternalRef(event.target.value)} placeholder="org/repo" />
            <button className="dialog-primary" type="submit"><Plus size={18} /> Connect a repository</button>
          </form>
          <p className="repo-connect-or">or</p>
          <GitHubRepoPicker accessToken={accessToken} workspaceId={workspaceId} onSelectRepo={(fullName) => { setExternalRef(fullName); void createConnectionFor(fullName); }} />
        </div>
      ) : (
        <>
          <nav className="repo-tabs">
            {TABS.map((item) => {
              const active = tab === item.id;
              return (
                <button type="button" key={item.id} className={active ? "repo-tab active" : "repo-tab"} onClick={() => setTab(item.id)}>
                  {active && (
                    <motion.span
                      layoutId="repo-tab-active"
                      className="repo-tab-active-indicator"
                      transition={reduceMotion ? { duration: 0 } : SPRING_SNAPPY}
                    />
                  )}
                  <span className="repo-tab-content">{item.icon}{item.label}</span>
                </button>
              );
            })}
          </nav>

          <motion.div
            key={tab}
            className="repo-tab-panel"
            initial={reduceMotion ? undefined : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: EASE_OUT_EXPO }}
          >
          {tab === "tree" && (
            <div className="repo-tree-layout">
              <div className="repo-tree-pane">
                {treeError && <p className="project-empty">{treeError}</p>}
                {folderTree && (
                  <VirtualizedRepoTree
                    tree={folderTree}
                    selected={selectedPath ? { path: selectedPath } : null}
                    onSelect={openFile}
                    expanded={expandedFolders}
                    toggle={(path) =>
                      setExpandedFolders((current) => {
                        const next = new Set(current);
                        if (next.has(path)) next.delete(path);
                        else next.add(path);
                        return next;
                      })
                    }
                    filterFolder={setActiveFolderFilter}
                    activeFilter={activeFolderFilter}
                  />
                )}
              </div>
              <div className="repo-file-pane">
                {selectedPath ? (
                  <>
                    <p className="repo-file-path">{selectedPath}</p>
                    <BlameHeatmap accessToken={accessToken} workspaceId={workspaceId} connectionId={connectionId} filePath={selectedPath} />
                    <pre className="infra-logs-output">{fileContent}</pre>
                  </>
                ) : (
                  <p className="project-empty">Select a file to view it.</p>
                )}
              </div>
            </div>
          )}

          {tab === "commits" && (
            <div className="repo-list">
              {commits.map((commit) => (
                <article className="operation-row" key={commit.sha}>
                  <strong>{commit.commit.message.split("\n")[0]}</strong>
                  <small>{commit.commit.author.name} · {commit.sha.slice(0, 7)}</small>
                </article>
              ))}
              {commits.length === 0 && <p className="project-empty">No commits loaded.</p>}
            </div>
          )}

          {tab === "branches" && (
            <div className="repo-list">
              <button type="button" className="dialog-primary" style={{ marginBottom: 10, alignSelf: "flex-start" }} onClick={() => setCompareOpen(true)} disabled={branches.length < 2}>
                Compare branches
              </button>
              {branches.map((b) => (
                <article className="operation-row" key={b.name}>
                  <strong>{b.name}</strong>
                  <small className="mono">{b.commit.sha.slice(0, 7)}</small>
                </article>
              ))}
              {branches.length === 0 && <p className="project-empty">No branches loaded.</p>}
              {compareOpen && (
                <BranchDiff
                  accessToken={accessToken}
                  workspaceId={workspaceId}
                  connectionId={connectionId}
                  branches={branches}
                  currentBranch={branch}
                  onClose={() => setCompareOpen(false)}
                />
              )}
            </div>
          )}

          {tab === "ownership" && (
            <CodeOwnershipMap accessToken={accessToken} workspaceId={workspaceId} connectionId={connectionId} files={tree} />
          )}

          {tab === "contributors" && (
            <ContributorInsights
              accessToken={accessToken}
              workspaceId={workspaceId}
              connectionId={connectionId}
              folders={[...new Set(tree.map((entry) => (entry.path.includes("/") ? entry.path.split("/")[0] : "(root)")))].slice(0, 12)}
            />
          )}

          {tab === "releases" && (
            <ReleaseNotesGenerator accessToken={accessToken} workspaceId={workspaceId} connectionId={connectionId} />
          )}

          {tab === "security" && (
            <VulnerabilityScanner vulns={vulns} loading={vulnsLoading} error={vulnsError} />
          )}

          {tab === "database" && (
            <Suspense fallback={tabPanelFallback}>
              <DatabaseSchemaPanel accessToken={accessToken} workspaceId={workspaceId} connectionId={connectionId} tree={tree} />
            </Suspense>
          )}

          {tab === "trends" && (
            <Suspense fallback={tabPanelFallback}>
              <TrendsPanel
                accessToken={accessToken}
                workspaceId={workspaceId}
                connectionId={connectionId}
                repoLabel={activeConnection?.external_ref || "repository"}
                trendSnapshots={trendSnapshots}
                activityPoints={activityPoints}
                trendsLoading={trendsLoading}
                onLoadTrends={() => void loadTrends()}
                analyzedFiles={analyzedFiles}
                connectionsGraph={connectionsGraph}
              />
            </Suspense>
          )}

          {tab === "pulls" && (
            <div className="repo-list">
              {pullRequests.map((pr) => (
                <article className="operation-row" key={pr.number}>
                  <strong>#{pr.number} {pr.title}</strong>
                  <small>{pr.user.login} · {pr.state}</small>
                </article>
              ))}
              {pullRequests.length === 0 && <p className="project-empty">No open pull requests.</p>}
            </div>
          )}

          {tab === "intelligence" && (
            <div className="repo-intelligence">
              <div className="repo-intelligence-actions">
                <button type="button" className="dialog-primary" onClick={() => void analyzeRepository()} disabled={analyzing}>
                  <Network size={16} /> {analyzing ? "Analyzing…" : `Analyze ${activeConnection?.external_ref || "repository"}`}
                </button>
                {analyzedFiles.length > 0 && (
                  <button type="button" className="dialog-cancel" onClick={() => setExportOpen(true)}>
                    Export graph
                  </button>
                )}
              </div>
              {analysisError && <p className="project-empty">{analysisError}</p>}
              {exportOpen && (
                <ExportModal
                  nodes={analyzedFiles.map((f) => ({ id: f.path, name: f.name, layer: f.folder }))}
                  edges={connectionsGraph}
                  svgRef={exportSvgRef}
                  repoUrl={activeConnection?.external_ref || ""}
                  filterState={{}}
                  onClose={() => setExportOpen(false)}
                />
              )}
              {health && (
                <div className="repo-health-row">
                  <div className="ring" style={{ background: `conic-gradient(var(--teal-600) 0 ${health.score}%, var(--border-subtle) ${health.score}% 100%)` }}>
                    <span>{health.grade}</span>
                  </div>
                  <div>
                    <strong>Health score: {health.score}/100</strong>
                    <p className="project-empty">{analyzedFiles.length} files analyzed · {functions.length} functions · {connectionsGraph.length} dependencies</p>
                  </div>
                </div>
              )}
              {issues.length > 0 && (
                <div className="repo-issues">
                  <h3><Shield size={14} /> Issues</h3>
                  {issues.map((issue) => (
                    <article className="operation-row" key={issue.title}>
                      <strong>{issue.title}</strong>
                      <small>{issue.detail}</small>
                    </article>
                  ))}
                </div>
              )}
              {analyzedFiles.length > 0 && (
                <div className="repo-blast">
                  <h3>Blast radius</h3>
                  <Select aria-label="File for blast radius" value={selectedBlastPath} onChange={(event) => setSelectedBlastPath(event.target.value)}>
                    {analyzedFiles.map((f) => (
                      <option key={f.path} value={f.path}>{f.path} ({fnCountByFile.get(f.path) || 0} fns)</option>
                    ))}
                  </Select>
                  {blast && (
                    <article className="operation-row">
                      <strong>{blast.count} direct dependents · {blast.transitiveCount} transitive</strong>
                      <em className={`state-${blast.level === "critical" || blast.level === "high" ? "failed" : blast.level === "medium" ? "running" : "succeeded"}`}>{blast.level}</em>
                    </article>
                  )}
                </div>
              )}
            </div>
          )}
          </motion.div>
        </>
      )}
    </div>
  );
}

