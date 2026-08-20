import type { FormEvent } from "react";

import type { Notification, WorkspaceNote, WorkspaceSchedule, WorkspaceTask } from "../api/chat";
import type { CiConnection, CiTriggerResult, PipelineRun } from "../api/cicd";
import type { InfraAction, InfraConnection, InfraGatewayResult, InfraResourceType } from "../api/infra";
import { Input, Select, Textarea } from "./ui/field";
import { Activity, Bell, CalendarDays, CheckSquare, FileText, Plus, X } from "lucide-react";
import { PipelineRunsPanel } from "./PipelineRunsPanel";
import { InfraResourcesPanel } from "./InfraResourcesPanel";
import { DialogShell } from "./ui/dialog-shell";

type OperationsDialogProps = {
  open: boolean;
  tasks: WorkspaceTask[];
  notes: WorkspaceNote[];
  notifications: Notification[];
  activity: { id: string; action: string; resource_type: string }[];
  schedules: WorkspaceSchedule[];
  taskTitle: string;
  noteTitle: string;
  noteContent: string;
  scheduleTitle: string;
  scheduleCron: string;
  onClose: () => void;
  onTaskTitleChange: (value: string) => void;
  onCreateTask: (event: FormEvent) => void;
  onTaskStatusChange: (task: WorkspaceTask, status: WorkspaceTask["status"]) => void;
  onNoteTitleChange: (value: string) => void;
  onNoteContentChange: (value: string) => void;
  onCreateNote: (event: FormEvent) => void;
  onScheduleTitleChange: (value: string) => void;
  onScheduleCronChange: (value: string) => void;
  onCreateSchedule: (event: FormEvent) => void;
  onScheduleEnabledChange: (schedule: WorkspaceSchedule) => void;
  ciConnections: CiConnection[];
  pipelineRuns: PipelineRun[];
  ciExternalRef: string;
  onCiExternalRefChange: (value: string) => void;
  onCreateCiConnection: (event: FormEvent) => void;
  ciConnectionId: string;
  onCiConnectionChange: (id: string) => void;
  githubToken: string;
  onGithubTokenChange: (value: string) => void;
  onRegisterCiCredential: (event: FormEvent) => void;
  workflowRef: string;
  onWorkflowRefChange: (value: string) => void;
  gitRef: string;
  onGitRefChange: (value: string) => void;
  onTriggerPipeline: (event: FormEvent) => void;
  ciTriggerResult: CiTriggerResult | null;
  infraConnections: InfraConnection[];
  infraConnectionId: string;
  onInfraConnectionChange: (id: string) => void;
  infraConnectionName: string;
  infraConnectionKind: InfraConnection["kind"];
  onInfraConnectionNameChange: (value: string) => void;
  onInfraConnectionKindChange: (kind: InfraConnection["kind"]) => void;
  onCreateInfraConnection: (event: FormEvent) => void;
  infraResourceType: InfraResourceType;
  onInfraResourceTypeChange: (type: InfraResourceType) => void;
  infraResult: InfraGatewayResult | null;
  onViewInfraLogs: (resourceRef: string) => void;
  onPerformInfraAction: (resourceRef: string, action: InfraAction, replicas?: number) => void;
};

export function OperationsDialog({
  open,
  tasks,
  notes,
  notifications,
  activity,
  schedules,
  taskTitle,
  noteTitle,
  noteContent,
  scheduleTitle,
  scheduleCron,
  onClose,
  onTaskTitleChange,
  onCreateTask,
  onTaskStatusChange,
  onNoteTitleChange,
  onNoteContentChange,
  onCreateNote,
  onScheduleTitleChange,
  onScheduleCronChange,
  onCreateSchedule,
  onScheduleEnabledChange,
  ciConnections,
  pipelineRuns,
  ciExternalRef,
  onCiExternalRefChange,
  onCreateCiConnection,
  ciConnectionId,
  onCiConnectionChange,
  githubToken,
  onGithubTokenChange,
  onRegisterCiCredential,
  workflowRef,
  onWorkflowRefChange,
  gitRef,
  onGitRefChange,
  onTriggerPipeline,
  ciTriggerResult,
  infraConnections,
  infraConnectionId,
  onInfraConnectionChange,
  infraConnectionName,
  infraConnectionKind,
  onInfraConnectionNameChange,
  onInfraConnectionKindChange,
  onCreateInfraConnection,
  infraResourceType,
  onInfraResourceTypeChange,
  infraResult,
  onViewInfraLogs,
  onPerformInfraAction,
}: OperationsDialogProps) {
  return (
    <DialogShell open={open} labelledBy="operations-title" className="operations-dialog">
      <header className="operations-dialog-header"><div><h2 id="operations-title">Workspace operations</h2><p>Manage your tasks, notes, schedules and updates in one place.</p></div><button type="button" className="operations-close-icon" aria-label="Close operations" onClick={onClose}><X size={24} /></button></header>
      <div className="operations-stack">
        <section className="operation-card operation-card-tasks"><div className="operation-card-copy"><div className="operation-card-heading"><span className="operation-icon"><CheckSquare size={20} /></span><div><h3>Tasks</h3><p>Create and track your tasks.</p></div></div><form onSubmit={onCreateTask}><Input aria-label="Task title" value={taskTitle} onChange={(event) => onTaskTitleChange(event.target.value)} placeholder="What needs to be done?" /><button className="dialog-primary" type="submit"><Plus size={18} /> Add task</button></form>{tasks.map((task) => <article className="operation-row" key={task.id}><strong>{task.title}</strong><Select aria-label={`Status for ${task.title}`} value={task.status} onChange={(event) => onTaskStatusChange(task, event.target.value as WorkspaceTask["status"])}><option value="open">open</option><option value="in_progress">in progress</option><option value="done">done</option><option value="cancelled">cancelled</option></Select></article>)}</div><div className="operation-art art-tasks"><CheckSquare size={74} /></div></section>
        <section className="operation-card operation-card-notes"><div className="operation-card-copy"><div className="operation-card-heading"><span className="operation-icon"><FileText size={20} /></span><div><h3>Notes</h3><p>Capture your thoughts and important details.</p></div></div><form onSubmit={onCreateNote}><Input aria-label="Note title" value={noteTitle} onChange={(event) => onNoteTitleChange(event.target.value)} placeholder="Note title" /><Textarea aria-label="Note content" value={noteContent} onChange={(event) => onNoteContentChange(event.target.value)} placeholder="Write your note here..." /><button className="dialog-primary" type="submit"><Plus size={18} /> Add note</button></form>{notes.map((note) => <article className="operation-row" key={note.id}><strong>{note.title}</strong></article>)}</div><div className="operation-art art-notes"><FileText size={74} /></div></section>
        <section className="operation-card operation-card-notifications"><div className="operation-card-heading"><span className="operation-icon"><Bell size={20} /></span><div><h3>Notifications</h3><p>Stay updated with important alerts.</p></div></div><span className="operation-count">{notifications.filter((item) => !item.read_at).length}</span><span className="operation-chevron">›</span>{notifications.filter((item) => !item.read_at).map((item) => <article className="operation-row" key={item.id}><strong>{item.title}</strong></article>)}</section>
        <section className="operation-card operation-card-schedules"><div className="operation-card-copy"><div className="operation-card-heading"><span className="operation-icon"><CalendarDays size={20} /></span><div><h3>Schedules</h3><p>Plan and manage your schedules.</p></div></div><form onSubmit={onCreateSchedule}><Input aria-label="Schedule title" value={scheduleTitle} onChange={(event) => onScheduleTitleChange(event.target.value)} placeholder="Schedule title" /><Input aria-label="Schedule cron" value={scheduleCron} onChange={(event) => onScheduleCronChange(event.target.value)} placeholder="e.g. 09 * * 1-5" /><button className="dialog-primary" type="submit"><CalendarDays size={17} /> Create schedule</button></form>{schedules.map((schedule) => <article className="operation-row" key={schedule.id}><strong>{schedule.title}</strong><button className="dialog-cancel" onClick={() => onScheduleEnabledChange(schedule)}>{schedule.enabled ? "Pause" : "Resume"}</button></article>)}</div><div className="operation-art art-schedules"><CalendarDays size={74} /></div></section>
        <section className="operation-card operation-card-activity"><div className="operation-card-heading"><span className="operation-icon"><Activity size={20} /></span><div><h3>Activity</h3><p>Review your recent workspace activity.</p></div></div><span className="operation-chevron">›</span>{activity.map((item) => <article className="operation-row" key={item.id}><strong>{item.action}</strong><span>{item.resource_type}</span></article>)}</section>
        <PipelineRunsPanel
          connections={ciConnections}
          runs={pipelineRuns}
          externalRef={ciExternalRef}
          onExternalRefChange={onCiExternalRefChange}
          onCreateConnection={onCreateCiConnection}
          connectionId={ciConnectionId}
          onConnectionChange={onCiConnectionChange}
          githubToken={githubToken}
          onGithubTokenChange={onGithubTokenChange}
          onRegisterCredential={onRegisterCiCredential}
          workflowRef={workflowRef}
          onWorkflowRefChange={onWorkflowRefChange}
          gitRef={gitRef}
          onGitRefChange={onGitRefChange}
          onTrigger={onTriggerPipeline}
          triggerResult={ciTriggerResult}
        />
        <InfraResourcesPanel
          connections={infraConnections}
          connectionId={infraConnectionId}
          onConnectionChange={onInfraConnectionChange}
          connectionName={infraConnectionName}
          connectionKind={infraConnectionKind}
          onConnectionNameChange={onInfraConnectionNameChange}
          onConnectionKindChange={onInfraConnectionKindChange}
          onCreateConnection={onCreateInfraConnection}
          resourceType={infraResourceType}
          onResourceTypeChange={onInfraResourceTypeChange}
          result={infraResult}
          onViewLogs={onViewInfraLogs}
          onPerformAction={onPerformInfraAction}
        />
      </div>
      <footer className="operations-dialog-footer"><button className="dialog-primary" onClick={onClose}>Close <X size={16} /></button></footer>
    </DialogShell>
  );
}
