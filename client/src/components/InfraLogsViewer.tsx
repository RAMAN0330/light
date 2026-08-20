import { ScrollText, X } from "lucide-react";
import { DialogShell } from "./ui/dialog-shell";

type InfraLogsViewerProps = {
  open: boolean;
  title: string;
  output: string;
  onClose: () => void;
};

export function InfraLogsViewer({ open, title, output, onClose }: InfraLogsViewerProps) {
  return (
    <DialogShell open={open} labelledBy="infra-logs-title" className="infra-logs-dialog">
      <header className="operations-dialog-header">
        <div>
          <h2 id="infra-logs-title">
            <ScrollText size={18} /> {title}
          </h2>
          <p>Read-only, fetched live from the connected host.</p>
        </div>
        <button type="button" className="operations-close-icon" aria-label="Close logs" onClick={onClose}>
          <X size={24} />
        </button>
      </header>
      <pre className="infra-logs-output">{output || "No log output yet."}</pre>
    </DialogShell>
  );
}
