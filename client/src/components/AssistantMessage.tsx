import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children }) => (
            <div className="table-wrapper">
              <table>{children}</table>
            </div>
          ),
          code: ({ className, children, ...props }) => {
            const isBlock = Boolean(className);
            if (isBlock) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className="inline-code" {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {normalized}
      </Markdown>
      {isStreaming && (
        <span className="streaming-cursor" aria-label="Streaming response" />
      )}
    </div>
  );
}
