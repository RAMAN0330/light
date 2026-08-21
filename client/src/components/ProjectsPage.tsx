import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight, CalendarDays, Clock3, FileText, FolderKanban, LogOut,
  MessageSquarePlus, Orbit, Pencil, Plus, Settings2, Trash2, UserPlus, UserRound, Users,
} from "lucide-react";
import { useRef, useState } from "react";
import type { Artifact, Conversation, OrganizationMember, Project, ProjectDocument } from "../api/chat";
import { fadeUp, scaleIn, SPRING_SNAPPY } from "../lib/motion";
import { relativeTime } from "../lib/relativeTime";
import { useOutsideClick } from "../lib/useOutsideClick";
import { Avatar } from "./ui/avatar";

type Props = {
  projects: Project[]; selectedProjectId: string; conversations: Conversation[];
  documents: ProjectDocument[]; artifacts?: Artifact[]; members?: OrganizationMember[];
  onSelectProject?: (id: string) => void; onCreateProject: () => void; onEditProject: () => void;
  onInviteMember: (event: React.FormEvent<HTMLFormElement>) => void;
  onInviteEmailChange: (value: string) => void; inviteEmail: string;
  onManageMembers?: () => void; onNavigateToWorkspace: () => void; onSignOut?: () => void;
  onDeleteProject?: (project: Project) => void;
  onOpenProject?: (id: string) => void;
};

function projectTimestamp(value?: string) {
  return relativeTime(value) || "Just now";
}

export function ProjectsPage({
  projects, selectedProjectId, conversations, documents, artifacts = [], members = [], onSelectProject,
  onCreateProject, onEditProject, onInviteMember, onInviteEmailChange, inviteEmail,
  onManageMembers, onNavigateToWorkspace, onSignOut, onDeleteProject, onOpenProject,
}: Props) {
  const reduceMotion = useReducedMotion();
  const [accountOpen, setAccountOpen] = useState(false);
  const accountAnchorRef = useRef<HTMLDivElement>(null);
  useOutsideClick(accountAnchorRef, accountOpen, () => setAccountOpen(false));
  const selected = projects.find((project) => project.id === selectedProjectId) || projects[0];
  const projectConversations = conversations.filter((conversation) => conversation.project_id === selected?.id);
  const activityTimestamps = [...projectConversations, ...documents]
    .map((item) => item.created_at).filter((value): value is string => Boolean(value)).sort();
  const latestActivity = activityTimestamps[activityTimestamps.length - 1];

  return (
    <div className="projects-page">
      <header className="projects-topbar" aria-label="Orbital workspace projects">
        <div className="projects-topbar-brand"><Orbit size={20} aria-hidden="true" /><strong>Orbital</strong><span aria-hidden="true" /><button type="button" onClick={onNavigateToWorkspace}>Workspace</button><b>/</b><em>Projects</em></div>
        <div className="projects-account-wrap" ref={accountAnchorRef}>
          <button type="button" className="projects-account-button" aria-label="Account menu" aria-expanded={accountOpen} onClick={() => setAccountOpen((open) => !open)}><strong>Account</strong><span>O</span></button>
          {accountOpen && <div className="projects-account-menu" role="menu"><button type="button" role="menuitem" onClick={onSignOut}><LogOut size={15} /> Sign out</button></div>}
        </div>
      </header>
      {!projects.length ? (
        <motion.section className="projects-empty-page" initial="hidden" animate="show" variants={scaleIn}>
          <span><FolderKanban size={34} /></span>
          <h2>Start your first project</h2>
          <p>Create a focused home for a body of work and its conversations.</p>
          <button type="button" className="projects-primary-action" onClick={onCreateProject}>Create project</button>
        </motion.section>
      ) : (
        <>
        <div className="projects-layout">
          <aside className="project-list-panel" aria-label="Projects">
            <div className="project-list-heading">
              <h2>Projects</h2>
              <button type="button" className="project-create-pill" aria-label="New project" onClick={onCreateProject}>
                <Plus size={17} aria-hidden="true" />
                <span className="project-create-pill-label">New project</span>
              </button>
            </div>
            <nav className="project-list" aria-label="Project list">
              {projects.map((project) => {
                const isSelected = project.id === selected?.id;
                return (
                  <div key={project.id} className="project-list-row">
                    <button type="button" className={`project-list-item${isSelected ? " is-selected" : ""}`} aria-current={isSelected ? "page" : undefined} onClick={() => onSelectProject?.(project.id)}>
                      <span className="project-list-icon"><FolderKanban size={16} /></span>
                      <span className="project-list-copy"><strong>{project.name}</strong><small>{project.instructions || "Project workspace"}</small><span className="project-list-owner"><UserRound size={12} /> You · Owner</span></span>
                    </button>
                    <button type="button" className="project-row-delete-button" aria-label="Delete project" title={`Delete ${project.name}`} onClick={() => onDeleteProject?.(project)}><Trash2 size={14} /></button>
                    <button type="button" className="project-row-open-button" onClick={() => onOpenProject?.(project.id)}>Open <ArrowRight size={13} /></button>
                  </div>
                );
              })}
            </nav>
          </aside>

          <motion.main className="project-detail" aria-labelledby="project-detail-title" key={selected?.id}
            initial={reduceMotion ? undefined : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={SPRING_SNAPPY}>
            <header className="project-detail-header">
              <div className="project-detail-title">
                <span className="project-detail-icon"><FolderKanban size={22} /></span>
                <div>
                  <h1 id="project-detail-title">{selected?.name}<button type="button" className="project-name-edit" aria-label="Rename project" onClick={onEditProject}><Pencil size={13} /></button></h1>
                  <p>{selected?.instructions || "Add instructions to keep every conversation aligned."}</p>
                </div>
              </div>
              <div className="project-detail-actions"><button type="button" className="project-settings-button" onClick={onEditProject}><Settings2 size={16} /> Project settings</button></div>
            </header>

            <div className="project-overview-grid">
              <section className="project-summary-section" aria-labelledby="project-details-heading">
                <h2 id="project-details-heading">Project details</h2>
                <div className="project-meta-grid">
                  <div><CalendarDays size={20} /><span><small>Created</small><strong>{projectTimestamp(selected?.created_at)}</strong></span></div>
                  <div><Clock3 size={20} /><span><small>Last updated</small><strong>{projectTimestamp(latestActivity || selected?.created_at)}</strong></span></div>
                  <div><Users size={20} /><span><small>Members</small><strong>{members.length || 1}</strong></span></div>
                </div>

                <div className="project-members-section">
                  <div className="project-section-title"><div><h2>Project members</h2><p>{members.length || 1} member{members.length === 1 ? "" : "s"}</p></div>{onManageMembers && <button type="button" onClick={onManageMembers}><Users size={15} /> Manage members</button>}</div>
                  <div className="project-member-stack">
                    {members.length ? <span className="project-member-avatars">{members.slice(0, 5).map((member) => <Avatar key={member.user_id} seed={member.user_id} className="project-member-avatar" />)}</span> : <Avatar seed="you" className="project-member-avatar" />}
                    <span><strong>{members.length ? "Workspace members" : "You"}</strong><small>{members.length ? "Members with project access" : "Project owner"}</small></span>
                  </div>
                  <form className="project-invite-form" onSubmit={onInviteMember}><UserPlus size={16} /><input type="email" aria-label="Member email" placeholder="Enter email address" value={inviteEmail} onChange={(event) => onInviteEmailChange(event.target.value)} /><button type="submit">Invite</button></form>
                </div>
              </section>

            </div>
          </motion.main>
        </div>
        </>
      )}
    </div>
  );
}
