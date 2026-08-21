import { ScrollText } from "lucide-react";
import { DialogShell, OverlayBody, OverlayHeader } from "./ui/dialog-shell";

type InfraLogsViewerProps = {
  open: boolean;
  title: string;
  output: string;
  onClose: () => void;
};

export function InfraLogsViewer({ open, title, output, onClose }: InfraLogsViewerProps) {
  return (
    <DialogShell open={open} labelledBy="infra-logs-title" className="infra-logs-dialog" onClose={onClose}>
      <OverlayHeader
        id="infra-logs-title"
        kicker="Logs"
        title={title}
        subtitle="Read-only, fetched live from the connected host."
        icon={<ScrollText size={16} />}
        onClose={onClose}
        closeLabel="Close logs"
      />
      <OverlayBody>
        <pre className="infra-logs-output">{output || "No log output yet."}</pre>
      </OverlayBody>
    </DialogShell>
  );
}
