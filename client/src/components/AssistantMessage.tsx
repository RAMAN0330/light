import { Streamdown } from "streamdown";
import "streamdown/styles.css";

function normalizeResponseMarkdown(content: string) {
  let inFence = false;
  return content
    .split("\n")
    .map((line) => {
      if (/^\s*```/.test(line)) inFence = !inFence;
      return inFence ? line : line.replace(/^ {1,4}(?=\S)/, "");
    })
    .join("\n");
}

type Props = {
  content: string;
  isStreaming?: boolean;
};

export function AssistantMessage({ content, isStreaming = false }: Props) {
  const normalized = normalizeResponseMarkdown(content);

  return (
    <div className={`assistant-content ${isStreaming ? "is-streaming" : ""}`}>
      {/* No table/code component overrides: Streamdown's own defaults already
          give tables and code blocks copy/download buttons, a responsive
          scroll wrapper, and syntax highlighting — richer than the bespoke
          .table-wrapper/.inline-code markup react-markdown needed. */}
      <Streamdown mode={isStreaming ? "streaming" : "static"}>{normalized}</Streamdown>
      {isStreaming && (
        <span className="streaming-cursor" aria-label="Streaming response" />
      )}
    </div>
  );
}
