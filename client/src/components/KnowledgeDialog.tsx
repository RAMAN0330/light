import type { ChangeEvent, FormEvent } from "react";

import type { Artifact, Citation, KnowledgeCollection } from "../api/chat";
import { Library } from "lucide-react";
import { Input, Select, Textarea } from "./ui/field";
import { DialogShell, OverlayBody, OverlayFooter, OverlayHeader, OverlaySection } from "./ui/dialog-shell";

type KnowledgeDialogProps = {
  open: boolean;
  artifacts: Artifact[];
  collections: KnowledgeCollection[];
  collectionId: string;
  knowledgeQuery: string;
  citations: Citation[];
  reportTitle: string;
  reportContent: string;
  onClose: () => void;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onCollectionChange: (value: string) => void;
  onKnowledgeQueryChange: (value: string) => void;
  onSearch: (event: FormEvent) => void;
  onReportTitleChange: (value: string) => void;
  onReportContentChange: (value: string) => void;
  onCreateReport: (event: FormEvent) => void;
};

export function KnowledgeDialog({
  open,
  artifacts,
  collections,
  collectionId,
  knowledgeQuery,
  citations,
  reportTitle,
  reportContent,
  onClose,
  onUpload,
  onCollectionChange,
  onKnowledgeQueryChange,
  onSearch,
  onReportTitleChange,
  onReportContentChange,
  onCreateReport,
}: KnowledgeDialogProps) {
  return (
    <DialogShell open={open} labelledBy="knowledge-title" className="overlay-wide" onClose={onClose}>
      <OverlayHeader
        id="knowledge-title"
        kicker="Retrieval"
        title="Workspace knowledge"
        subtitle="Private sources available for cited retrieval."
        icon={<Library size={16} />}
        onClose={onClose}
        closeLabel="Close knowledge"
      />
      <OverlayBody>
        <OverlaySection title="Add a source">
          <label className="project-upload">
            Upload a document
            <Input type="file" accept=".txt,.md,.markdown,.csv,.doc,.docx,.docm,.odt,.ods,.odp,.rtf,.epub,.pdf,.ppt,.pps,.pot,.pptx,.pptm,.ppsx,.ppsm,.xls,.xlsx,.xlsm,.xlsb,text/plain,text/markdown" onChange={onUpload} />
          </label>
        </OverlaySection>

        <OverlaySection title="Search sources">
          <form onSubmit={onSearch}>
            <Select aria-label="Knowledge collection" value={collectionId} onChange={(event) => onCollectionChange(event.target.value)}>
              <option value="">Select collection</option>
              {collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}
            </Select>
            <Input aria-label="Search workspace knowledge" value={knowledgeQuery} onChange={(event) => onKnowledgeQueryChange(event.target.value)} placeholder="Search sources" />
            <button className="dialog-primary" type="submit">Search</button>
          </form>
        </OverlaySection>

        <OverlaySection title="Cited report">
          <form onSubmit={onCreateReport}>
            <Input aria-label="Report title" value={reportTitle} onChange={(event) => onReportTitleChange(event.target.value)} placeholder="Report title" />
            <Textarea aria-label="Report content" value={reportContent} onChange={(event) => onReportContentChange(event.target.value)} placeholder="Write a cited research report" />
            <button className="dialog-primary" type="submit">Save report</button>
          </form>
        </OverlaySection>

        <OverlaySection title="Sources">
          <div className="skill-list">
            {citations.map((citation) => <article className="skill-row" key={`${citation.artifact_id}-${citation.start_offset}`}><div><strong>{citation.artifact_name}</strong><small>{citation.excerpt}</small></div><span>{citation.start_offset}–{citation.end_offset}</span></article>)}
            {artifacts.length ? artifacts.map((artifact) => <article className="skill-row" key={artifact.id}><div><strong>{artifact.name}</strong><small>{artifact.failure_reason || "Private workspace source"}</small></div><span>{artifact.status}</span></article>) : <p className="project-empty">No workspace sources yet.</p>}
          </div>
        </OverlaySection>
      </OverlayBody>
      <OverlayFooter>
        <button className="dialog-primary" onClick={onClose}>Close</button>
      </OverlayFooter>
    </DialogShell>
  );
}
