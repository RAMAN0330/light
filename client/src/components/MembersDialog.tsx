import type { OrganizationMember } from "../api/chat";
import { DialogShell } from "./ui/dialog-shell";
import { Avatar } from "./ui/avatar";
import { relativeTime } from "../lib/relativeTime";

type MembersDialogProps = {
  open: boolean;
  members: OrganizationMember[];
  onClose: () => void;
};

export function MembersDialog({ open, members, onClose }: MembersDialogProps) {
  return (
    <DialogShell open={open} labelledBy="members-title">
      <h2 id="members-title">Workspace members</h2>
      <p>Everyone with access to this organization's workspaces.</p>
      <div className="skill-list">
        {members.length ? members.map((member) => (
          <article className="skill-row" key={member.user_id}>
            <span className="member-row-identity">
              <Avatar seed={member.user_id} />
              <span><strong>{member.user_id}</strong><small>Joined {relativeTime(member.created_at) || "recently"}</small></span>
            </span>
            <span>{member.role}</span>
          </article>
        )) : <p className="project-empty">No members found.</p>}
      </div>
      <div><button className="dialog-primary" onClick={onClose}>Close</button></div>
    </DialogShell>
  );
}
