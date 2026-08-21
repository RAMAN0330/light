import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Building2, CheckCircle2, LogOut, Orbit, Plus, Search, ShieldCheck, Trash2, UserPlus, Users } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { OrganizationMember, Workspace } from "../api/chat";
import { useOutsideClick } from "../lib/useOutsideClick";
import { Avatar } from "./ui/avatar";

type Props = {
  workspaces: Workspace[];
  workspaceId: string;
  members?: OrganizationMember[];
  workspaceInviteEmail: string;
  onSelectWorkspace: (id: string) => void;
  onOpenWorkspace: (id: string) => void;
  onCreateWorkspace: () => void;
  onWorkspaceInviteEmailChange: (value: string) => void;
  onInviteWorkspaceMember: (event: React.FormEvent<HTMLFormElement>) => void;
  onManageMembers?: () => void;
  onSignOut?: () => void;
  onDeleteWorkspace?: (workspace: Workspace) => void;
};

export function WorkspacesPage({ workspaces, workspaceId, members = [], workspaceInviteEmail, onSelectWorkspace, onOpenWorkspace, onCreateWorkspace, onWorkspaceInviteEmailChange, onInviteWorkspaceMember, onManageMembers, onSignOut, onDeleteWorkspace }: Props) {
  const [query, setQuery] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const accountAnchorRef = useRef<HTMLDivElement>(null);
  useOutsideClick(accountAnchorRef, accountOpen, () => setAccountOpen(false));
  const reduceMotion = useReducedMotion();
  const visibleWorkspaces = useMemo(
    () => workspaces.filter((workspace) => workspace.name.toLowerCase().includes(query.trim().toLowerCase())),
    [query, workspaces],
  );
  return (
    <div className="organization-page workspace-details-page">
      <header className="organization-topbar workspace-details-topbar">
        <div className="organization-brand">
          <Orbit aria-hidden="true" size={20} strokeWidth={1.9} />
          <strong>Orbital</strong><span aria-hidden="true" /><em>Workspaces</em>
        </div>
        <div className="workspace-account-wrap" ref={accountAnchorRef}>
          <button type="button" className="workspace-account-button" aria-label="Account menu" aria-expanded={accountOpen} onClick={() => setAccountOpen((open) => !open)}><strong>Account</strong><span>O</span></button>
          {accountOpen && <div className="workspace-account-menu" role="menu"><button type="button" role="menuitem" onClick={onSignOut}><LogOut size={15} /> Sign out</button></div>}
        </div>
      </header>

      {!workspaces.length ? (
        <main className="workspace-empty-page">
          <span><Building2 size={34} /></span>
          <h1>Start your first workspace</h1>
          <p>Create a shared home for your organization&apos;s projects and conversations.</p>
          <button className="projects-primary-action" type="button" onClick={onCreateWorkspace}><Plus size={16} /> Create workspace</button>
        </main>
      ) : (
        <main className="workspace-catalog">
          <div className="workspace-catalog-heading">
            <div><h1>Your workspaces</h1><p>Select a workspace to view its projects and conversations.</p></div>
            <span className="workspace-catalog-actions"><button className="workspace-create-button" type="button" aria-label="New workspace" onClick={onCreateWorkspace}><Plus size={18} /></button></span>
          </div>
          <label className="workspace-list-search">
            <Search aria-hidden="true" size={16} />
            <span className="sr-only">Search workspaces</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workspaces" />
          </label>
          <section className="workspace-card-grid" aria-label="Workspace list">
            {visibleWorkspaces.map((workspace, index) => {
              const accessLabel = workspace.role === "owner" ? "Owner access" : `${workspace.role} access`;
              return (
                <motion.article
                  key={workspace.id}
                  className={`workspace-card-panel${workspace.id === workspaceId ? " is-selected" : ""}`}
                  initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.03, ease: "easeOut" }}
                  onClick={() => onSelectWorkspace(workspace.id)}
                >
                  <span className="workspace-card-panel-header"><span className="workspace-detail-icon"><Building2 size={22} /></span><span><strong>{workspace.name}</strong><small>Shared workspace</small></span></span>
                  <span className="workspace-card-panel-meta"><span><ShieldCheck size={16} /> {accessLabel}</span><span><CheckCircle2 size={16} /> Active</span><span className="workspace-card-actions"><button type="button" className="workspace-open-button" onClick={(event) => { event.stopPropagation(); onOpenWorkspace(workspace.id); }}>Open <ArrowRight size={14} /></button><button type="button" className="workspace-delete-button" aria-label="Delete workspace" title={`Delete ${workspace.name}`} onClick={(event) => { event.stopPropagation(); onDeleteWorkspace?.(workspace); }}><Trash2 size={15} /></button></span></span>
                </motion.article>
              );
            })}
          </section>
          {!visibleWorkspaces.length && <p className="workspace-list-empty">No workspace matches “{query}”.</p>}
          <section className="workspace-invite-section" aria-labelledby="workspace-invite-heading">
            <div className="project-section-title"><div><h2 id="workspace-invite-heading">Invite members to this workspace</h2><p>Invite teammates to collaborate across projects.</p></div>{onManageMembers && <button type="button" onClick={onManageMembers}><Users size={15} /> Manage members</button>}</div>
            <div className="workspace-member-stack">
              {members.length ? <span className="project-member-avatars">{members.slice(0, 5).map((member) => <Avatar key={member.user_id} seed={member.user_id} className="workspace-member-avatar" />)}</span> : <Avatar seed="you" className="workspace-member-avatar" />}
              <span><strong>{members.length ? `${members.length} workspace member${members.length === 1 ? "" : "s"}` : "You"}</strong><small>{members.length ? "Workspace members" : "Workspace owner"}</small></span>
            </div>
            <form className="project-invite-form workspace-invite-form" onSubmit={onInviteWorkspaceMember}><UserPlus size={16} /><input type="email" aria-label="Workspace member email" placeholder="Enter email address" value={workspaceInviteEmail} onChange={(event) => onWorkspaceInviteEmailChange(event.target.value)} /><button type="submit">Invite</button></form>
          </section>
        </main>
      )}
    </div>
  );
}
