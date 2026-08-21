import { motion, useReducedMotion } from "framer-motion";
import { useRef, useState } from "react";
import {
  Braces,
  CircleUserRound,
  FileSearch,
  GitBranch,
  Gauge,
  Library,
  MessageSquareText,
  Orbit,
  LogOut,
  SearchCode,
  Sparkles,
  Workflow,
} from "lucide-react";
import { fadeUp, staggerChildren, SPRING_SNAPPY } from "../lib/motion";
import { useOutsideClick } from "../lib/useOutsideClick";

export type WorkspaceSurface = "overview" | "conversations" | "projects" | "repositories" | "workspaces" | "project-picker";

type Props = {
  surface: WorkspaceSurface;
  conversationCount: number;
  projectCount: number;
  onOverview: () => void;
  onConversations: () => void;
  onProjects: () => void;
  onRepositories: () => void;
  onOperations: () => void;
  onKnowledge: () => void;
  onLauncher: (mode: "research" | "analyze" | "code") => void;
  onNavigateHome?: () => void;
  onSignOut?: () => void;
};

type NavItemConfig = {
  id: string;
  icon: React.ReactNode;
  label: string;
  ariaLabel?: string;
  count?: number;
  active: boolean;
  onClick: () => void;
};

type NavSectionConfig = {
  title: string;
  items: NavItemConfig[];
};

// Single source of truth for the sidebar's navigation entries. Every item here
// automatically gets an icon, a label, and a collapsed-mode tooltip — add new
// pages by extending this config rather than hand-writing another NavButton.
function useNavSections(props: Props): NavSectionConfig[] {
  const { surface, conversationCount, onOverview, onConversations, onRepositories, onOperations, onKnowledge, onLauncher } = props;
  return [
    {
      title: "Workspace",
      items: [
        { id: "overview", icon: <Gauge size={18} />, label: "Overview", active: surface === "overview", onClick: onOverview },
        { id: "conversations", icon: <MessageSquareText size={18} />, label: "Conversations", ariaLabel: "Conversations", count: conversationCount, active: surface === "conversations", onClick: onConversations },
        { id: "repositories", icon: <GitBranch size={18} />, label: "Repositories", active: surface === "repositories", onClick: onRepositories },
      ],
    },
    {
      title: "Intelligence",
      items: [
        { id: "research", icon: <FileSearch size={18} />, label: "Research & scraping", active: false, onClick: () => onLauncher("research") },
        { id: "analysis", icon: <Braces size={18} />, label: "Analysis", active: false, onClick: () => onLauncher("analyze") },
        { id: "knowledge", icon: <Library size={18} />, label: "Knowledge", ariaLabel: "Knowledge", active: false, onClick: onKnowledge },
        { id: "codebases", icon: <SearchCode size={18} />, label: "Codebases", active: false, onClick: () => onLauncher("code") },
      ],
    },
    {
      title: "Manage",
      items: [
        { id: "automations", icon: <Workflow size={18} />, label: "Automations", active: false, onClick: onOperations },
      ],
    },
  ];
}

function NavButton({ id, icon, label, count, active, ariaLabel, onClick, reduceMotion }: NavItemConfig & { reduceMotion: boolean | null }) {
  return (
    <motion.button
      type="button"
      variants={fadeUp}
      className={active ? "workspace-nav-item active" : "workspace-nav-item"}
      aria-label={ariaLabel ?? label}
      aria-current={active ? "page" : undefined}
      title={label}
      onClick={onClick}
      data-nav-id={id}
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
        <span className="sidebar-inline-label">{label}</span>
        {typeof count === "number" && <small className="sidebar-inline-label">{count}</small>}
      </span>
    </motion.button>
  );
}

export function WorkspaceSidebar(props: Props) {
  const { onNavigateHome, onSignOut } = props;
  const reduceMotion = useReducedMotion();
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountAnchorRef = useRef<HTMLDivElement>(null);
  const sections = useNavSections(props);

  useOutsideClick(accountAnchorRef, isAccountMenuOpen, () => setIsAccountMenuOpen(false));

  return (
    <aside className="workspace-sidebar">
      <button type="button" className="workspace-brand" aria-label="Go to Orbital landing page" title="Orbital" onClick={onNavigateHome}>
        <span className="workspace-brand-row">
          <span className="workspace-brand-mark">
            <Orbit aria-hidden="true" size={22} strokeWidth={1.8} />
            <Sparkles className="workspace-brand-sparkle" aria-hidden="true" size={15} strokeWidth={2.1} />
          </span>
          <strong className="sidebar-inline-label">Orbital</strong>
          <small className="sidebar-inline-label">Enterprise workspace</small>
        </span>
      </button>

      <motion.nav
        className="workspace-navigation"
        aria-label="Workspace navigation"
        initial="hidden"
        animate="show"
        variants={staggerChildren(0.04)}
      >
        {sections.map((section) => (
          <section key={section.title}>
            <p>{section.title}</p>
            {section.items.map((item) => (
              <NavButton key={item.id} {...item} reduceMotion={reduceMotion} />
            ))}
          </section>
        ))}
      </motion.nav>

      <div className="workspace-sidebar-footer">
        <div className="workspace-account-anchor" ref={accountAnchorRef}>
          <button
            type="button"
            className="workspace-account"
            aria-haspopup="menu"
            aria-expanded={isAccountMenuOpen}
            title="Account"
            onClick={() => setIsAccountMenuOpen((current) => !current)}
          >
            <CircleUserRound aria-hidden="true" size={20} />
            <span className="sidebar-inline-label"><strong>Account</strong><small>Profile & preferences</small></span>
          </button>
          {isAccountMenuOpen && (
            <div className="workspace-sidebar-account-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsAccountMenuOpen(false);
                  onSignOut?.();
                }}
              >
                <LogOut aria-hidden="true" size={15} />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
