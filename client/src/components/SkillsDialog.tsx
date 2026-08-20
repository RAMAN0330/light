import type { Skill } from "../api/chat";
import { DialogShell } from "./ui/dialog-shell";

type SkillsDialogProps = {
  open: boolean;
  skills: Skill[];
  importing: boolean;
  onClose: () => void;
  onImportAll: () => void;
};

export function SkillsDialog({ open, skills, importing, onClose, onImportAll }: SkillsDialogProps) {
  return (
    <DialogShell open={open} labelledBy="skills-title">
      <h2 id="skills-title">Workspace skills</h2>
      <p>Published processes remain governed by Orbital’s declared tool and data permissions.</p>
      <button className="dialog-primary" disabled={importing} onClick={onImportAll}>{importing ? "Importing…" : "Import upstream processes"}</button>
      <div className="skill-list">
        {skills.length ? skills.map((skill) => <article className="skill-row" key={skill.id}><div><strong>{skill.name}</strong><small>v{skill.version} · {skill.manifest.tools.join(", ") || "No tools"}</small>{skill.manifest.source && <small>{String(skill.manifest.source)} · {String(skill.manifest.license || "License recorded")}</small>}</div><span>{skill.status[0].toUpperCase() + skill.status.slice(1)}</span></article>) : <p className="project-empty">No governed skills are registered for this workspace.</p>}
      </div>
      <div><button className="dialog-primary" onClick={onClose}>Close</button></div>
    </DialogShell>
  );
}
