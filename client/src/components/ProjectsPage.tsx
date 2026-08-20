import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  FileText,
  FolderKanban,
  MessageSquarePlus,
  MessagesSquare,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import type { Artifact, Conversation, OrganizationMember, Project, ProjectDocument } from "../api/chat";
import { fadeUp, scaleIn, staggerChildren, SPRING_SNAPPY } from "../lib/motion";
import { relativeTime } from "../lib/relativeTime";
import { Avatar } from "./ui/avatar";

type Props = {
  projects: Project[];
  selectedProjectId: string;
  conversations: Conversation[];
  documents: ProjectDocument[];
  artifacts?: Artifact[];
  members?: OrganizationMember[];
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onNewConversation: () => void;
  onEditProject: () => void;
  onInviteMember: (event: React.FormEvent<HTMLFormElement>) => void;
  onInviteEmailChange: (value: string) => void;
  inviteEmail: string;
  onUploadDocument: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteDocument: (id: string) => void;
  onViewAllConversations?: () => void;
  onManageMembers?: () => void;
};

export function ProjectsPage({
  projects,
  selectedProjectId,
  conversations,
  documents,
  artifacts = [],
  members = [],
  onSelectProject,
  onCreateProject,
  onNewConversation,
  onEditProject,
  onInviteMember,
  onInviteEmailChange,
  inviteEmail,
  onUploadDocument,
  onDeleteDocument,
  onViewAllConversations,
  onManageMembers,
}: Props) {
  const reduceMotion = useReducedMotion();
  const [search, setSearch] = useState("");
  const selected = projects.find((project) => project.id === selectedProjectId) || projects[0];
  const projectConversations = conversations.filter((conversation) => conversation.project_id === selected?.id);
  const visibleProjects = useMemo(
    () => projects.filter((project) => project.name.toLowerCase().includes(search.trim().toLowerCase())),
    [projects, search],
  );

  const stats = [
    { label: "Total projects", value: projects.length, icon: <FolderKanban size={17} />, tone: "teal" },
    { label: "Total conversations", value: conversations.length, icon: <MessagesSquare size={17} />, tone: "emerald" },
    { label: "Reference files", value: artifacts.length, icon: <FileText size={17} />, tone: "cyan" },
    { label: "Active members", value: members.length, icon: <Users size={17} />, tone: "teal" },
  ] as const;

  return (
    <div className="projects-page">
      <motion.p className="projects-breadcrumb" initial="hidden" animate="show" variants={fadeUp}>Workspace / Projects</motion.p>
      {!projects.length ? (
        <motion.section className="projects-empty-page" initial="hidden" animate="show" variants={scaleIn}>
          <span><FolderKanban size={34} /></span>
          <h2>Start your first project</h2>
          <p>Create a focused home for a body of work and its conversations.</p>
          <button type="button" className="projects-primary-action" onClick={onCreateProject}>Create project</button>
        </motion.section>
      ) : (
        <>
          <motion.div className="projects-stat-grid" aria-label="Workspace summary" initial="hidden" animate="show" variants={staggerChildren(0.05)}>
            {stats.map((stat) => (
              <motion.div className="projects-stat-card" key={stat.label} variants={fadeUp}>
                <span className={`projects-stat-icon projects-stat-icon-${stat.tone}`}>{stat.icon}</span>
                <span>
                  <small>{stat.label}</small>
                  <strong>{stat.value}</strong>
                </span>
              </motion.div>
            ))}
          </motion.div>

          <div className="projects-layout">
            <motion.aside className="project-list-panel" aria-label="Projects list" initial="hidden" animate="show" variants={staggerChildren(0.04)}>
              <div className="project-list-heading">
                <span>Your projects</span>
                <span className="project-list-heading-actions">
                  <small>{projects.length}</small>
                  <button
                    type="button"
                    className="project-create-pill"
                    onClick={onCreateProject}
                    aria-label="New project"
                    title="New project"
                  >
                    <Plus aria-hidden="true" size={15} />
                    <span className="project-create-pill-label">New project</span>
                  </button>
                </span>
              </div>
              <div className="project-search">
                <Search size={14} aria-hidden="true" />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search projects…"
                  aria-label="Search projects"
                />
              </div>
              {visibleProjects.map((project) => {
                const isActive = project.id === selected?.id;
                return (
                  <motion.button
                    type="button"
                    key={project.id}
                    variants={fadeUp}
                    className={isActive ? "project-list-item active" : "project-list-item"}
                    onClick={() => onSelectProject(project.id)}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="project-list-active"
                        className="project-list-active-indicator"
                        transition={reduceMotion ? { duration: 0 } : SPRING_SNAPPY}
                      />
                    )}
                    <span className="project-list-icon"><FolderKanban size={16} /></span>
                    <span><strong>{project.name}</strong><small>{relativeTime(project.created_at) ? `Created ${relativeTime(project.created_at)}` : project.instructions || "No description yet"}</small></span>
                    <ArrowRight size={15} />
                  </motion.button>
                );
              })}
              {!visibleProjects.length && <p className="project-empty">No projects match “{search}”.</p>}
            </motion.aside>

            <motion.main
              className="project-detail"
              aria-labelledby="project-detail-title"
              key={selected?.id}
              initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <header className="project-detail-header">
                <div className="project-detail-title">
                  <span className="project-detail-icon"><FolderKanban size={22} /></span>
                  <div>
                    <h2 id="project-detail-title">
                      {selected?.name}
                      <button type="button" className="project-name-edit" aria-label="Rename project" onClick={onEditProject}><Pencil size={13} /></button>
                    </h2>
                    <p>{selected?.instructions || "Add instructions to keep every conversation aligned."}</p>
                  </div>
                </div>
                <div className="project-detail-actions">
                  <button type="button" onClick={onEditProject}><Settings2 size={15} /> Settings</button>
                  <button type="button" className="projects-primary-action" onClick={onNewConversation}><MessageSquarePlus size={15} /> New conversation</button>
                </div>
              </header>

              <motion.div className="project-detail-grid" initial="hidden" animate="show" variants={staggerChildren(0.06)}>
                <motion.section className="project-content-card project-conversations-card" variants={fadeUp}>
                  <div className="project-card-heading"><div><h3>Conversations</h3><p>Chats connected to this project</p></div><span>{projectConversations.length}</span></div>
                  {projectConversations.length ? projectConversations.slice(0, 6).map((conversation) => (
                    <div className="project-conversation-row" key={conversation.id}>
                      <MessageSquarePlus size={16} />
                      <span>
                        <strong>{conversation.title}</strong>
                        {relativeTime(conversation.created_at) && <small>Started {relativeTime(conversation.created_at)}</small>}
                      </span>
                      <ArrowRight size={15} />
                    </div>
                  )) : <div className="project-card-empty"><MessageSquarePlus size={28} /><p>No conversations yet.</p><button type="button" onClick={onNewConversation}>Start a conversation</button></div>}
                  {projectConversations.length > 0 && onViewAllConversations && (
                    <button type="button" className="project-card-footer-link" onClick={onViewAllConversations}>
                      View all conversations <ArrowRight size={14} />
                    </button>
                  )}
                </motion.section>

                <motion.section className="project-content-card" variants={fadeUp}>
                  <div className="project-card-heading"><div><h3>Reference files</h3><p>Documents available to this project</p></div><span>{documents.length}</span></div>
                  <label className="project-upload-button"><Upload size={15} /> Add .txt or .md<input type="file" accept=".txt,.md" onChange={onUploadDocument} /></label>
                  {documents.length ? documents.map((document) => (
                    <div className="project-document-row" key={document.id}><FileText size={16} /><span>{document.name}</span><button type="button" aria-label={`Delete ${document.name}`} onClick={() => onDeleteDocument(document.id)}><Trash2 size={14} /></button></div>
                  )) : <div className="project-card-empty compact"><FileText size={28} /><p>No reference files yet.</p></div>}
                </motion.section>

                <motion.section className="project-content-card" variants={fadeUp}>
                  <div className="project-card-heading"><div><h3>Members</h3><p>Invite people who need this context</p></div></div>
                  <form className="project-invite-form" onSubmit={onInviteMember}><UserPlus size={16} /><input type="email" aria-label="Member email" placeholder="name@company.com" value={inviteEmail} onChange={(event) => onInviteEmailChange(event.target.value)} /><button type="submit">Invite</button></form>
                  {members.length > 0 && (
                    <div className="project-member-stack" aria-label={`${members.length} workspace members`}>
                      <span className="project-member-avatars">
                        {members.slice(0, 5).map((member) => (
                          <Avatar key={member.user_id} seed={member.user_id} className="project-member-avatar" />
                        ))}
                      </span>
                      <small>{members.length} member{members.length === 1 ? "" : "s"}</small>
                      {onManageMembers && (
                        <button type="button" className="project-manage-members" onClick={onManageMembers}>
                          <Users size={14} /> Manage members
                        </button>
                      )}
                    </div>
                  )}
                </motion.section>
              </motion.div>
            </motion.main>
          </div>
        </>
      )}
    </div>
  );
}
