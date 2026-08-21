import type { FormEvent } from "react";

import type { ApprovalRequest, IntelligenceAdapter, Policy } from "../api/chat";
import { ShieldCheck } from "lucide-react";
import { Input } from "./ui/field";
import { DialogShell, OverlayBody, OverlayFooter, OverlayHeader, OverlaySection } from "./ui/dialog-shell";

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
    <DialogShell open={open} labelledBy="governance-title" className="governance-dialog overlay-wide" onClose={onClose}>
      <OverlayHeader
        id="governance-title"
        kicker="Policy"
        title="Workspace governance"
        subtitle="Policies decide whether a tool is allowed, blocked, or sent to human approval."
        icon={<ShieldCheck size={16} />}
        onClose={onClose}
        closeLabel="Close governance"
      />
      <OverlayBody>
        <OverlaySection title="Policy rules">
          {policies.length
            ? policies.map((policy) => (
                <article className="skill-row" key={policy.id}>
                  <div><strong>{policy.action}</strong><small>{policy.enabled ? "Enabled" : "Disabled"}</small></div>
                  <span>{policy.decision.replace(/_/g, " ")}</span>
                </article>
              ))
            : <p className="project-empty">No explicit policy rules. Unknown actions require approval.</p>}
        </OverlaySection>

        <OverlaySection title="Approval inbox">
          {pendingRequests.length
            ? pendingRequests.map((request) => (
                <article className="skill-row" key={request.id}>
                  <div><strong>{request.summary}</strong><small>Governed tool request</small></div>
                  <span>Pending</span>
                </article>
              ))
            : <p className="project-empty">No approvals are waiting.</p>}
        </OverlaySection>

        <OverlaySection title="Intelligence adapters">
          <p className="project-empty">Registration is disabled by default and requires policy approval before use.</p>
          <div className="overlay-adapters">
            {adapters.map((name) => (
              <button className="dialog-cancel" key={name} onClick={() => onRegisterAdapter(name)}>Register {name}</button>
            ))}
          </div>
          {adapterMessage && <p className="project-empty">{adapterMessage}</p>}
        </OverlaySection>

        <OverlaySection title="Skill observation">
          <form onSubmit={onCreateObservation}>
            <Input aria-label="Observation title" value={observationTitle} onChange={(event) => onObservationTitleChange(event.target.value)} placeholder="Suggested skill title" />
            <button className="dialog-primary" type="submit">Create draft observation</button>
          </form>
        </OverlaySection>
      </OverlayBody>
      <OverlayFooter>
        <button className="dialog-primary" onClick={onClose}>Close</button>
      </OverlayFooter>
    </DialogShell>
  );
}
