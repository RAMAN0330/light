import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, FolderKanban, Orbit, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Project, Workspace } from "../api/chat";

type Props = {
  workspace?: Workspace;
  projects: Project[];
  onBack: () => void;
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
};

export function ProjectPickerPage({ workspace, projects, onBack, onSelectProject, onCreateProject }: Props) {
  const [query, setQuery] = useState("");
  const reduceMotion = useReducedMotion();
  const visibleProjects = useMemo(
    () => projects.filter((project) => project.name.toLowerCase().includes(query.trim().toLowerCase())),
    [projects, query],
  );

  return (
    <div className="organization-page project-picker-page">
      <header className="organization-topbar">
        <div className="organization-brand">
          <span className="organization-brand-mark"><Orbit aria-hidden="true" size={20} strokeWidth={1.9} /></span>
          <button className="picker-back" type="button" onClick={onBack}><ArrowLeft aria-hidden="true" size={15} /> Workspaces</button>
          <span aria-hidden="true">/</span>
          <strong>Projects</strong>
        </div>
        <button className="organization-create" type="button" onClick={onCreateProject}>
          <Plus aria-hidden="true" size={17} strokeWidth={2.1} />
          New project
        </button>
      </header>

      <main className="organization-content">
        <h1>Your projects</h1>
        {workspace ? <p className="project-picker-workspace">Inside {workspace.name}</p> : null}
        <div className="organization-toolbar">
          <label className="organization-search">
            <Search aria-hidden="true" size={19} />
            <span className="sr-only">Search projects</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search for a project" />
          </label>
        </div>

        <div className="organization-list" aria-label="Your projects">
          <button type="button" className="organization-card project-create-card" onClick={onCreateProject}>
            <span className="organization-card-mark"><Plus aria-hidden="true" size={21} /></span>
            <span className="organization-card-copy"><strong>Add new project</strong><small>Create a focused home for your work</small></span>
            <ArrowRight className="organization-card-arrow" aria-hidden="true" size={18} />
          </button>
          {visibleProjects.map((project, index) => (
            <motion.article
              key={project.id}
              className="organization-card"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.28, delay: index * 0.04, ease: "easeOut" }}
            >
              <span className="organization-card-mark"><FolderKanban aria-hidden="true" size={21} /></span>
              <span className="organization-card-copy"><strong>{project.name}</strong><small>{project.instructions || "Project workspace"}</small></span>
              <button type="button" className="project-open-button" onClick={() => onSelectProject(project.id)}>Open <ArrowRight aria-hidden="true" size={16} /></button>
            </motion.article>
          ))}
        </div>

        {!projects.length ? <p className="organization-empty">Create the first project for this workspace to begin organizing work.</p> : null}
        {projects.length > 0 && !visibleProjects.length ? <p className="organization-empty">No project matches “{query}”.</p> : null}
      </main>
    </div>
  );
}
