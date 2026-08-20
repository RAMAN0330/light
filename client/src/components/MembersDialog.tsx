import { Users } from "lucide-react";
import type { OrganizationMember } from "../api/chat";
import { DialogShell, OverlayBody, OverlayFooter, OverlayHeader } from "./ui/dialog-shell";
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
      <OverlayHeader
        id="members-title"
        kicker="Access"
        title="Workspace members"
        subtitle="Everyone with access to this organization's workspaces."
        icon={<Users size={16} />}
        onClose={onClose}
        closeLabel="Close members"
      />
      <OverlayBody>
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
      </OverlayBody>
      <OverlayFooter>
        <button className="dialog-primary" onClick={onClose}>Close</button>
      </OverlayFooter>
    </DialogShell>
  );
}
