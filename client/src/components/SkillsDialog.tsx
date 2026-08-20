import { Sparkles } from "lucide-react";
import type { Skill } from "../api/chat";
import { DialogShell, OverlayBody, OverlayFooter, OverlayHeader } from "./ui/dialog-shell";

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
      <OverlayHeader
        id="skills-title"
        kicker="Governed processes"
        title="Workspace skills"
        subtitle="Published processes remain governed by Orbital’s declared tool and data permissions."
        icon={<Sparkles size={16} />}
        onClose={onClose}
        closeLabel="Close skills"
      />
      <OverlayBody>
        <div className="skill-list">
          {skills.length ? skills.map((skill) => (
            <article className="skill-row" key={skill.id}>
              <div>
                <strong>{skill.name}</strong>
                <small>v{skill.version} · {skill.manifest.tools.join(", ") || "No tools"}</small>
                {skill.manifest.source && <small>{String(skill.manifest.source)} · {String(skill.manifest.license || "License recorded")}</small>}
              </div>
              <span>{skill.status[0].toUpperCase() + skill.status.slice(1)}</span>
            </article>
          )) : <p className="project-empty">No governed skills are registered for this workspace.</p>}
        </div>
      </OverlayBody>
      <OverlayFooter>
        <button className="dialog-cancel" disabled={importing} onClick={onImportAll}>{importing ? "Importing…" : "Import upstream processes"}</button>
        <button className="dialog-primary" onClick={onClose}>Close</button>
      </OverlayFooter>
    </DialogShell>
  );
}
