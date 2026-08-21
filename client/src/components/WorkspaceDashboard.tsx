import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  Bot,
  Braces,
  CalendarClock,
  CircleAlert,
  Clock3,
  FileSearch,
  ListChecks,
  Orbit,
  SearchCode,
  ShieldCheck,
  Timer,
  Workflow,
  GitBranch,
} from "lucide-react";
import type {
  ApprovalRequest,
  Artifact,
  Notification,
  Project,
  WorkspaceSchedule,
  WorkspaceTask,
} from "../api/chat";
import { repositoryApi } from "../api/repositories";
import { AnimatedNumber } from "./ui/animated-number";
import { useLenis } from "../lib/useLenis";
import { fadeUp, staggerChildren } from "../lib/motion";

type LauncherMode = "query" | "research" | "scrape" | "analyze" | "automate" | "code";

type Props = {
  tasks: WorkspaceTask[];
  schedules: WorkspaceSchedule[];
  notifications: Notification[];
  activity: { id: string; action: string; resource_type: string }[];
  approvals: ApprovalRequest[];
  artifacts: Artifact[];
  projects: Project[];
  accessToken: string;
  workspaceId: string;
  onLauncher: (mode: LauncherMode) => void;
  onOperations: () => void;
  onKnowledge: () => void;
  onGovernance: () => void;
  onProjectCreate: () => void;
  onNavigateToWorkspace: () => void;
  onNavigateToProjects: () => void;
};

const capabilities: { mode: LauncherMode; title: string; detail: string; icon: React.ReactNode }[] = [
  { mode: "automate", title: "Build an automation", detail: "Turn repeatable work into a schedule.", icon: <Workflow size={17} /> },
  { mode: "scrape", title: "Scrape a source", detail: "Collect evidence from approved destinations.", icon: <FileSearch size={17} /> },
  { mode: "analyze", title: "Analyze data", detail: "Inspect files & findings with traceability.", icon: <Braces size={17} /> },
  { mode: "code", title: "Work on a codebase", detail: "Investigate architecture or plan changes.", icon: <SearchCode size={17} /> },
];

export function WorkspaceDashboard({
  tasks,
  schedules,
  notifications,
  activity,
  approvals,
  artifacts,
  projects,
  accessToken,
  workspaceId,
  onLauncher,
  onOperations,
  onKnowledge,
  onGovernance,
  onProjectCreate,
  onNavigateToWorkspace,
  onNavigateToProjects,
}: Props) {
  const openTasks = tasks.filter((task) => task.status === "open" || task.status === "in_progress");
  const enabledSchedules = schedules.filter((schedule) => schedule.enabled);
  const pendingApprovals = approvals.filter((approval) => approval.status === "pending");
  const unreadNotifications = notifications.filter((notification) => !notification.read_at);
  const connectedProjects = projects.filter((project) => project.repository_connection_id);

  const workQueueRef = useRef<HTMLDivElement>(null);
  useLenis(workQueueRef);

  const [latestCommitIssueCount, setLatestCommitIssueCount] = useState(0);
  useEffect(() => {
    if (!workspaceId || !connectedProjects.length) { setLatestCommitIssueCount(0); return; }
    let cancelled = false;
    void (async () => {
      const counts = await Promise.all(
        connectedProjects.map((project) =>
          repositoryApi
            .commitAnalyses(accessToken, workspaceId, project.repository_connection_id as string)
            .then((analyses) => analyses[0]?.issues.length ?? 0)
            .catch(() => 0),
        ),
      );
      if (!cancelled) setLatestCommitIssueCount(counts.reduce((total, count) => total + count, 0));
    })();
    return () => { cancelled = true; };
  }, [accessToken, workspaceId, connectedProjects.map((project) => project.repository_connection_id).join(",")]);

  return (
    <motion.div className="workspace-dashboard" initial="hidden" animate="show" variants={staggerChildren(0.06)}>
      <motion.header className="dashboard-header" variants={fadeUp}>
        <div>
          <nav className="dashboard-breadcrumb" aria-label="Breadcrumb">
            <span className="dashboard-breadcrumb-bar" aria-hidden="true" />
            <button type="button" onClick={onNavigateToWorkspace}>Workspace</button>
            <b aria-hidden="true">/</b>
            <button type="button" onClick={onNavigateToProjects}>Projects</button>
            <b aria-hidden="true">/</b>
            <em aria-current="page">Overview</em>
          </nav>
        </div>
        <div className="workspace-health" aria-label="Workspace status: Operational">
          <span />
          Operational
        </div>
      </motion.header>

      {/* KPI Cards */}
      <motion.div className="dashboard-kpi-grid" aria-label="Workspace summary" variants={staggerChildren(0.05)}>
        <motion.div className="kpi-card" variants={fadeUp}>
          <div className="kpi-card-label">
            <span className="kpi-icon kpi-icon-teal"><ListChecks size={15} /></span>
            <span>Active tasks</span>
          </div>
          <div className="kpi-card-value">
            <strong><AnimatedNumber value={openTasks.length} /></strong>
            <small>current</small>
          </div>
        </motion.div>

        <motion.div className="kpi-card" variants={fadeUp}>
          <div className="kpi-card-label">
            <span className="kpi-icon kpi-icon-emerald"><Timer size={15} /></span>
            <span>Enabled schedules</span>
          </div>
          <div className="kpi-card-value">
            <strong><AnimatedNumber value={enabledSchedules.length} /></strong>
            <small>current</small>
          </div>
        </motion.div>

        <motion.div className="kpi-card" variants={fadeUp}>
          <div className="kpi-card-label">
            <span className="kpi-icon kpi-icon-cyan"><GitBranch size={15} /></span>
            <span>Connected repositories</span>
          </div>
          <div className="kpi-card-value">
            <strong><AnimatedNumber value={connectedProjects.length} /></strong>
            <small>current</small>
          </div>
        </motion.div>

        <motion.div className="kpi-card" variants={fadeUp}>
          <div className="kpi-card-label">
            <span className="kpi-icon kpi-icon-teal"><CircleAlert size={15} /></span>
            <span>Latest commit issues</span>
          </div>
          <div className="kpi-card-value">
            <strong><AnimatedNumber value={latestCommitIssueCount} /></strong>
            <small>current</small>
          </div>
        </motion.div>
      </motion.div>

      {/* Main Viewport Content Grid (Fitted to 100vh) */}
      <div className="dashboard-viewport-grid">
        {/* Left Operational Column */}
        <motion.div className="dashboard-column-left" variants={fadeUp}>
          {/* Work in Motion */}
          <section className="work-queue" aria-labelledby="work-queue-title">
            <div className="dashboard-section-heading">
              <div>
                <h2 id="work-queue-title">Work in motion</h2>
                <p>Tasks & schedules owned by this workspace</p>
              </div>
              <button type="button" onClick={onOperations}>
                Operations <ArrowUpRight size={14} />
              </button>
            </div>
            {openTasks.length || enabledSchedules.length ? (
              <div className="operational-list" ref={workQueueRef}>
                {openTasks.slice(0, 3).map((task) => (
                  <div key={task.id} className="operational-row">
                    <span className="operation-icon"><Clock3 size={15} /></span>
                    <span className="operation-text">
                      <strong>{task.title}</strong>
                      <small>Task · {task.status.replace("_", " ")}</small>
                    </span>
                    <em className={`state-${task.status}`}>{task.status === "in_progress" ? "In progress" : "Ready"}</em>
                  </div>
                ))}
                {enabledSchedules.slice(0, 3).map((schedule) => (
                  <div key={schedule.id} className="operational-row">
                    <span className="operation-icon"><CalendarClock size={15} /></span>
                    <span className="operation-text">
                      <strong>{schedule.title}</strong>
                      <small>Schedule · {schedule.cron_expression}</small>
                    </span>
                    <em className="state-enabled">Enabled</em>
                  </div>
                ))}
              </div>
            ) : (
              <div className="dashboard-empty-state">
                <span className="empty-state-visual"><Orbit size={34} strokeWidth={1.6} /></span>
                <div><strong>No active work</strong><p>Create an automation or assign a task when ready.</p></div>
                <button type="button" onClick={() => onLauncher("automate")}>Create automation</button>
              </div>
            )}
          </section>

          {/* Start Work Capabilities */}
          <section className="capability-section" aria-labelledby="capability-title">
            <div className="dashboard-section-heading">
              <div>
                <h2 id="capability-title">Start work</h2>
                <p>Choose an outcome for governed execution</p>
              </div>
            </div>
            <div className="capability-list">
              {capabilities.map((capability) => (
                <button type="button" key={capability.mode} onClick={() => onLauncher(capability.mode)}>
                  <span className="capability-icon">{capability.icon}</span>
                  <span className="capability-copy">
                    <strong>{capability.title}</strong>
                    <p>{capability.detail}</p>
                  </span>
                  <ArrowRight aria-hidden="true" size={17} />
                </button>
              ))}
            </div>
          </section>
        </motion.div>

        {/* Right Governance & Context Column */}
        <motion.div className="dashboard-column-right" variants={fadeUp}>
          {/* Needs Attention Rail */}
          <section className="attention-rail" aria-labelledby="attention-title">
            <div className="dashboard-section-heading">
              <div>
                <h2 id="attention-title">Needs attention</h2>
                <p>Policy & governance signals</p>
              </div>
            </div>
            <div className="attention-list">
              <button type="button" className="attention-item" onClick={onGovernance}>
                <span className="attention-icon"><ShieldCheck size={16} /></span>
                <span className="attention-text">
                  <strong>{pendingApprovals.length} pending approval{pendingApprovals.length === 1 ? "" : "s"}</strong>
                  <small>Review protected actions</small>
                </span>
                <ArrowUpRight size={14} />
              </button>
              <button type="button" className="attention-item" onClick={onKnowledge}>
                <span className="attention-icon"><CircleAlert size={16} /></span>
                <span className="attention-text">
                  <strong>{artifacts.filter((artifact) => artifact.status === "failed").length} failed sources</strong>
                  <small>Inspect ingestion status</small>
                </span>
                <ArrowUpRight size={14} />
              </button>
              <div className="attention-item static">
                <span className="attention-icon"><Bot size={16} /></span>
                <span className="attention-text">
                  <strong>{unreadNotifications.length} unread notification{unreadNotifications.length === 1 ? "" : "s"}</strong>
                  <small>Workspace updates</small>
                </span>
              </div>
            </div>
          </section>

          {/* Recent Activity */}
          <section className="context-card" aria-labelledby="activity-title">
            <div className="dashboard-section-heading">
              <div>
                <h2 id="activity-title"><Clock3 size={17} /> Recent activity</h2>
              </div>
            </div>
            <div className="plain-list">
              {activity.length ? activity.slice(0, 3).map((item) => (
                <div key={item.id} className="activity-row">
                  <span className="activity-dot" />
                  <span>
                    <strong>{item.action}</strong>
                    <small>{item.resource_type.replace("_", " ")}</small>
                  </span>
                </div>
              )) : <div className="context-empty"><span><Clock3 size={34} /></span><p>No recent activity.</p><small>You're all caught up.</small></div>}
            </div>
          </section>
        </motion.div>
      </div>
    </motion.div>
  );
}
