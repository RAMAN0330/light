import MetricsTrendChart from "../features/analysis/components/MetricsTrendChart";
import StaleCodeRadar from "../features/analysis/components/StaleCodeRadar";
import TechDebtTimeline from "../features/analysis/components/TechDebtTimeline";
import type { ActivityPoint, TrendSnapshot } from "../features/analysis/services/trends";

type AnalyzedFile = { path: string; name: string; folder: string };
type GraphConnection = { source: string; target: string; fn: string; count: number };

export function TrendsPanel({
  accessToken,
  workspaceId,
  connectionId,
  repoLabel,
  trendSnapshots,
  activityPoints,
  trendsLoading,
  onLoadTrends,
  analyzedFiles,
  connectionsGraph,
}: {
  accessToken: string;
  workspaceId: string;
  connectionId: string;
  repoLabel: string;
  trendSnapshots: TrendSnapshot[];
  activityPoints: ActivityPoint[];
  trendsLoading: boolean;
  onLoadTrends: () => void;
  analyzedFiles: AnalyzedFile[];
  connectionsGraph: GraphConnection[];
}) {
  return (
    <div className="repo-trends">
      <button type="button" className="dialog-primary" onClick={onLoadTrends} disabled={trendsLoading}>
        {trendsLoading ? "Loading trends…" : "Load trends from recent commits"}
      </button>
      <MetricsTrendChart snapshots={trendSnapshots} activityPoints={activityPoints} loading={trendsLoading} onCommitClick={() => {}} />
      {analyzedFiles.length === 0 ? (
        <p className="project-empty">Run "Analyze {repoLabel}" in Codebase Intelligence first to see stale-code and tech-debt views.</p>
      ) : (
        <>
          <StaleCodeRadar accessToken={accessToken} workspaceId={workspaceId} connectionId={connectionId} files={analyzedFiles} connections={connectionsGraph} />
          <TechDebtTimeline accessToken={accessToken} workspaceId={workspaceId} connectionId={connectionId} currentData={{ stats: { files: analyzedFiles.length }, files: analyzedFiles }} />
        </>
      )}
    </div>
  );
}
