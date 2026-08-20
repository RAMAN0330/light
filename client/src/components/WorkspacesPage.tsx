import { motion } from "framer-motion";
import { Building2, Check, Plus } from "lucide-react";
import type { Workspace } from "../api/chat";
import { fadeUp, scaleIn, staggerChildren } from "../lib/motion";

type Props = {
  workspaces: Workspace[];
  workspaceId: string;
  onSelectWorkspace: (id: string) => void;
  onCreateWorkspace: () => void;
};

export function WorkspacesPage({ workspaces, workspaceId, onSelectWorkspace, onCreateWorkspace }: Props) {
  return (
    <div className="workspaces-page">
      <motion.p className="projects-breadcrumb" initial="hidden" animate="show" variants={fadeUp}>Workspace / Workspaces</motion.p>

      <motion.div className="workspaces-grid" initial="hidden" animate="show" variants={staggerChildren(0.05)}>
        {workspaces.map((workspace) => {
          const active = workspace.id === workspaceId;
          return (
            <motion.button
              key={workspace.id}
              type="button"
              variants={scaleIn}
              aria-pressed={active}
              className={active ? "workspace-card is-active" : "workspace-card"}
              onClick={() => onSelectWorkspace(workspace.id)}
            >
              <span className="workspace-card-mark"><Building2 aria-hidden="true" size={18} /></span>
              <strong>{workspace.name}</strong>
              <small>{workspace.role}</small>
              {active ? (
                <span className="workspace-card-badge"><Check aria-hidden="true" size={12} /> Active</span>
              ) : null}
            </motion.button>
          );
        })}

        <motion.button
          type="button"
          variants={scaleIn}
          className="workspace-card workspace-card-create"
          onClick={onCreateWorkspace}
        >
          <span className="workspace-card-mark"><Plus aria-hidden="true" size={18} /></span>
          <strong>Create workspace</strong>
          <small>Scope people, projects and connectors</small>
        </motion.button>
      </motion.div>

      {!workspaces.length ? (
        <motion.p className="workspaces-empty" initial="hidden" animate="show" variants={fadeUp}>
          No workspaces yet — create the first one to start.
        </motion.p>
      ) : null}
    </div>
  );
}
