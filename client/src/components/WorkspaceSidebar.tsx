import { motion, useReducedMotion } from "framer-motion";
import {
  Braces,
  Building2,
  CircleUserRound,
  FileSearch,
  FolderKanban,
  GitBranch,
  Gauge,
  Library,
  MessageSquareText,
  Orbit,
  SearchCode,
  Workflow,
} from "lucide-react";
import { fadeUp, staggerChildren, SPRING_SNAPPY } from "../lib/motion";

export type WorkspaceSurface = "overview" | "conversations" | "projects" | "repositories" | "workspaces";

type Props = {
  surface: WorkspaceSurface;
  workspaceCount: number;
  conversationCount: number;
  projectCount: number;
  onWorkspaces: () => void;
  onOverview: () => void;
  onConversations: () => void;
  onProjects: () => void;
  onRepositories: () => void;
  onNewConversation: () => void;
  onOperations: () => void;
  onKnowledge: () => void;
  onLauncher: (mode: "research" | "analyze" | "code") => void;
};

function NavButton({
  id,
  icon,
  label,
  count,
  active,
  ariaLabel,
  onClick,
  reduceMotion,
}: {
  id: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
  active?: boolean;
  ariaLabel?: string;
  onClick: () => void;
  reduceMotion: boolean | null;
}) {
  return (
    <motion.button
      type="button"
      variants={fadeUp}
      className={active ? "workspace-nav-item active" : "workspace-nav-item"}
      aria-label={ariaLabel}
      aria-current={active ? "page" : undefined}
      onClick={onClick}
    >
      {active && (
        <motion.span
          layoutId="workspace-nav-active"
          className="workspace-nav-active-indicator"
          transition={reduceMotion ? { duration: 0 } : SPRING_SNAPPY}
        />
      )}
      <span className="workspace-nav-item-content">
        {icon}
        <span>{label}</span>
        {typeof count === "number" && <small>{count}</small>}
      </span>
    </motion.button>
  );
}

export function WorkspaceSidebar({
  surface,
  workspaceCount,
  conversationCount,
  projectCount,
  onWorkspaces,
  onOverview,
  onConversations,
  onProjects,
  onRepositories,
  onNewConversation,
  onOperations,
  onKnowledge,
  onLauncher,
}: Props) {
  const reduceMotion = useReducedMotion();

  return (
    <aside className="workspace-sidebar">
      <div className="workspace-brand">
        <span className="workspace-brand-row">
          <span className="workspace-brand-mark">
            <Orbit aria-hidden="true" size={22} strokeWidth={1.8} />
          </span>
          <strong>Orbital</strong>
        </span>
        <small>Enterprise workspace</small>
      </div>

      <motion.nav
        className="workspace-navigation"
        aria-label="Workspace navigation"
        initial="hidden"
        animate="show"
        variants={staggerChildren(0.04)}
      >
        <section>
          <p>Workspace</p>
          <NavButton id="workspaces" icon={<Building2 size={18} />} label="Workspaces" count={workspaceCount} active={surface === "workspaces"} onClick={onWorkspaces} reduceMotion={reduceMotion} />
          <NavButton id="overview" icon={<Gauge size={18} />} label="Overview" active={surface === "overview"} onClick={onOverview} reduceMotion={reduceMotion} />
          <NavButton id="conversations" icon={<MessageSquareText size={18} />} label="Conversations" ariaLabel="Conversations" count={conversationCount} active={surface === "conversations"} onClick={onConversations} reduceMotion={reduceMotion} />
          <NavButton id="projects" icon={<FolderKanban size={18} />} label="Projects" count={projectCount} active={surface === "projects"} onClick={onProjects} reduceMotion={reduceMotion} />
          <NavButton id="repositories" icon={<GitBranch size={18} />} label="Repositories" active={surface === "repositories"} onClick={onRepositories} reduceMotion={reduceMotion} />
        </section>
        <section>
          <p>Intelligence</p>
          <NavButton id="research" icon={<FileSearch size={18} />} label="Research & scraping" onClick={() => onLauncher("research")} reduceMotion={reduceMotion} />
          <NavButton id="analysis" icon={<Braces size={18} />} label="Analysis" onClick={() => onLauncher("analyze")} reduceMotion={reduceMotion} />
          <NavButton id="knowledge" icon={<Library size={18} />} label="Knowledge" ariaLabel="Knowledge" onClick={onKnowledge} reduceMotion={reduceMotion} />
          <NavButton id="codebases" icon={<SearchCode size={18} />} label="Codebases" onClick={() => onLauncher("code")} reduceMotion={reduceMotion} />
        </section>
        <section>
          <p>Manage</p>
          <NavButton id="automations" icon={<Workflow size={18} />} label="Automations" onClick={onOperations} reduceMotion={reduceMotion} />
        </section>
      </motion.nav>

      <div className="workspace-sidebar-footer">
        <button type="button" className="new-conversation-link" onClick={onNewConversation}>
          <MessageSquareText aria-hidden="true" size={17} />
          New conversation
        </button>
        <button type="button" className="workspace-account">
          <CircleUserRound aria-hidden="true" size={20} />
          <span><strong>Account</strong><small>Profile & preferences</small></span>
        </button>
      </div>
    </aside>
  );
}
