import type { FormEvent } from "react";

import type { ApprovalRequest, IntelligenceAdapter, Policy } from "../api/chat";
import { Input } from "./ui/field";
import { DialogShell } from "./ui/dialog-shell";

type GovernanceDialogProps = {
  open: boolean;
  policies: Policy[];
  approvalRequests: ApprovalRequest[];
  adapterMessage: string;
  observationTitle: string;
  onClose: () => void;
  onRegisterAdapter: (name: IntelligenceAdapter) => void;
  onObservationTitleChange: (value: string) => void;
  onCreateObservation: (event: FormEvent) => void;
};

const adapters: IntelligenceAdapter[] = ["graphify", "graft", "headroom", "agent_reach"];

export function GovernanceDialog({ open, policies, approvalRequests, adapterMessage, observationTitle, onClose, onRegisterAdapter, onObservationTitleChange, onCreateObservation }: GovernanceDialogProps) {
  const pendingRequests = approvalRequests.filter((item) => item.status === "pending");

  return (
    <DialogShell open={open} labelledBy="governance-title" className="governance-dialog">
      <h2 id="governance-title">Workspace governance</h2>
      <p>Policies decide whether a tool is allowed, blocked, or sent to human approval.</p>
      <div className="governance-section"><h3>Policy rules</h3>{policies.length ? policies.map((policy) => <article className="skill-row" key={policy.id}><div><strong>{policy.action}</strong><small>{policy.enabled ? "Enabled" : "Disabled"}</small></div><span>{policy.decision.replace(/_/g, " ")}</span></article>) : <p className="project-empty">No explicit policy rules. Unknown actions require approval.</p>}</div>
      <div className="governance-section"><h3>Approval inbox</h3>{pendingRequests.length ? pendingRequests.map((request) => <article className="skill-row" key={request.id}><div><strong>{request.summary}</strong><small>Governed tool request</small></div><span>Pending</span></article>) : <p className="project-empty">No approvals are waiting.</p>}</div>
      <div className="governance-section"><h3>Intelligence adapters</h3><p className="project-empty">Registration is disabled by default and requires policy approval before use.</p>{adapters.map((name) => <button className="dialog-cancel" key={name} onClick={() => onRegisterAdapter(name)}>Register {name}</button>)}{adapterMessage && <p className="project-empty">{adapterMessage}</p>}</div>
      <div className="governance-section"><h3>Skill observation</h3><form onSubmit={onCreateObservation}><Input aria-label="Observation title" value={observationTitle} onChange={(event) => onObservationTitleChange(event.target.value)} placeholder="Suggested skill title" /><button className="dialog-primary" type="submit">Create draft observation</button></form></div>
      <div><button className="dialog-primary" onClick={onClose}>Close</button></div>
    </DialogShell>
  );
}
