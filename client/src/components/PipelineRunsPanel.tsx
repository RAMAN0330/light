import type { FormEvent } from "react";
import { useState } from "react";

import type { CiConnection, CiTriggerResult, PipelineRun } from "../api/cicd";
import { Input, Select } from "./ui/field";
import { GitBranch, Play, Plus } from "lucide-react";

type PipelineRunsPanelProps = {
  connections: CiConnection[];
  runs: PipelineRun[];
  externalRef: string;
  onExternalRefChange: (value: string) => void;
  onCreateConnection: (event: FormEvent) => void;
  connectionId: string;
  onConnectionChange: (id: string) => void;
  githubToken: string;
  onGithubTokenChange: (value: string) => void;
  onRegisterCredential: (event: FormEvent) => void;
  workflowRef: string;
  onWorkflowRefChange: (value: string) => void;
  gitRef: string;
  onGitRefChange: (value: string) => void;
  onTrigger: (event: FormEvent) => void;
  triggerResult: CiTriggerResult | null;
};

const STATUS_LABEL: Record<PipelineRun["status"], string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function PipelineRunsPanel({
  connections,
  runs,
  externalRef,
  onExternalRefChange,
  onCreateConnection,
  connectionId,
  onConnectionChange,
  githubToken,
  onGithubTokenChange,
  onRegisterCredential,
  workflowRef,
  onWorkflowRefChange,
  gitRef,
  onGitRefChange,
  onTrigger,
  triggerResult,
}: PipelineRunsPanelProps) {
  const [showTokenForm, setShowTokenForm] = useState(false);

  return (
    <section className="operation-card operation-card-pipelines">
      <div className="operation-card-copy">
        <div className="operation-card-heading">
          <span className="operation-icon">
            <GitBranch size={20} />
          </span>
          <div>
            <h3>CI/CD pipelines</h3>
            <p>Connect a repository's CI provider to see and trigger its pipeline runs here.</p>
          </div>
        </div>
        <form onSubmit={onCreateConnection}>
          <Input
            aria-label="GitHub repository (org/repo)"
            value={externalRef}
            onChange={(event) => onExternalRefChange(event.target.value)}
            placeholder="org/repo"
          />
          <button className="dialog-primary" type="submit">
            <Plus size={18} /> Connect GitHub Actions
          </button>
        </form>
        {connections.length === 0 ? (
          <p className="project-empty">No CI connections yet.</p>
        ) : (
          <>
            <Select aria-label="CI connection" value={connectionId} onChange={(event) => onConnectionChange(event.target.value)}>
              {connections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.external_ref}
                </option>
              ))}
            </Select>

            <button type="button" className="infra-toggle-link" onClick={() => setShowTokenForm((open) => !open)}>
              {showTokenForm ? "Cancel" : "Set write-scope token"}
            </button>
            {showTokenForm && (
              <form onSubmit={onRegisterCredential}>
                <Input
                  aria-label="GitHub token with workflow scope"
                  type="password"
                  value={githubToken}
                  onChange={(event) => onGithubTokenChange(event.target.value)}
                  placeholder="ghp_… (workflow scope)"
                />
                <button className="dialog-primary" type="submit">
                  Save token
                </button>
              </form>
            )}

            <form onSubmit={onTrigger} className="ci-trigger-form">
              <Input aria-label="Workflow file" value={workflowRef} onChange={(event) => onWorkflowRefChange(event.target.value)} placeholder="ci.yml" />
              <Input aria-label="Git ref" value={gitRef} onChange={(event) => onGitRefChange(event.target.value)} placeholder="main" />
              <button className="dialog-primary" type="submit">
                <Play size={16} /> Trigger
              </button>
            </form>
            {triggerResult?.status === "approval_required" && <p className="project-empty">Trigger requires workspace approval — check the Approval inbox.</p>}
            {triggerResult?.status === "denied" && <p className="project-empty">{triggerResult.reason}</p>}
            {triggerResult?.status === "unavailable" && <p className="project-empty">{triggerResult.reason}</p>}
            {triggerResult?.status === "failed" && <p className="project-empty">{triggerResult.error}</p>}
            {triggerResult?.status === "completed" && <p className="project-empty">Triggered — watch the runs below.</p>}
          </>
        )}
        {runs.map((run) => (
          <article className="operation-row" key={run.id}>
            <strong>{run.pipeline_name}</strong>
            <small>
              {run.branch || "unknown branch"} {run.commit_sha ? `· ${run.commit_sha.slice(0, 7)}` : ""}
            </small>
            <em className={`state-${run.status}`}>{STATUS_LABEL[run.status]}</em>
          </article>
        ))}
      </div>
      <div className="operation-art art-pipelines">
        <GitBranch size={74} />
      </div>
    </section>
  );
}
