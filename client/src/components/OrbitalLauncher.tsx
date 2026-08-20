import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Bot,
  Braces,
  FileSearch,
  MessageSquareText,
  Orbit,
  SearchCode,
  SendHorizontal,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";
import { EASE_OUT_EXPO, SPRING_SNAPPY } from "../lib/motion";

export type LauncherMode = "query" | "research" | "scrape" | "analyze" | "automate" | "code";

const modes: { id: LauncherMode; label: string; icon: React.ReactNode }[] = [
  { id: "query", label: "Query", icon: <MessageSquareText size={16} /> },
  { id: "research", label: "Research", icon: <FileSearch size={16} /> },
  { id: "scrape", label: "Scrape", icon: <Orbit size={16} /> },
  { id: "analyze", label: "Analyze", icon: <Braces size={16} /> },
  { id: "automate", label: "Automate", icon: <Workflow size={16} /> },
  { id: "code", label: "Code task", icon: <SearchCode size={16} /> },
];

const modeCopy: Record<LauncherMode, { title: string; placeholder: string; action: string }> = {
  query: { title: "Ask across your workspace", placeholder: "Ask a question or describe the outcome you need…", action: "Send request" },
  research: { title: "Start governed research", placeholder: "What should Orbital investigate and cite?", action: "Start research" },
  scrape: { title: "Collect from approved sources", placeholder: "Describe the sources and structured data you need…", action: "Start scraping" },
  analyze: { title: "Analyze workspace data", placeholder: "What should Orbital inspect, compare, or explain?", action: "Start analysis" },
  automate: { title: "Build an automation", placeholder: "Describe the trigger, steps, and desired result…", action: "Build automation" },
  code: { title: "Resolve codebase work", placeholder: "Describe the repository task, bug, or change…", action: "Start code task" },
};

type Props = {
  open: boolean;
  mode: LauncherMode;
  loading: boolean;
  onOpen: () => void;
  onClose: () => void;
  onModeChange: (mode: LauncherMode) => void;
  onSubmit: (prompt: string, mode: LauncherMode) => Promise<void>;
};

export function OrbitalLauncher({ open, mode, loading, onOpen, onClose, onModeChange, onSubmit }: Props) {
  const [prompt, setPrompt] = useState("");
  const [hovered, setHovered] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (open) window.requestAnimationFrame(() => textareaRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  const copy = modeCopy[mode];
  const expanded = open || hovered;

  return (
    <div className="orbital-launcher right">
      <AnimatePresence>
        {open && (
          <motion.section
            className="orbital-launcher-panel"
            role="dialog"
            aria-labelledby="orbital-launcher-title"
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={reduceMotion ? { duration: 0.12 } : SPRING_SNAPPY}
          >
            <header>
              <span className="launcher-orbit"><Bot aria-hidden="true" size={20} /></span>
              <div><h2 id="orbital-launcher-title">{copy.title}</h2><p>Sources, tools, and approvals stay attached to the run.</p></div>
              <button type="button" className="launcher-close" aria-label="Close Orbital" onClick={onClose}><X size={18} /></button>
            </header>
            <div className="launcher-modes" aria-label="Work type">
              {modes.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={mode === item.id}
                  onClick={() => onModeChange(item.id)}
                >
                  {mode === item.id && (
                    <motion.span
                      layoutId="launcher-mode-highlight"
                      className="launcher-mode-highlight"
                      transition={reduceMotion ? { duration: 0 } : SPRING_SNAPPY}
                    />
                  )}
                  <span className="launcher-mode-content">{item.icon}<span>{item.label}</span></span>
                </button>
              ))}
            </div>
            <form
              onSubmit={async (event) => {
                event.preventDefault();
                if (!prompt.trim() || loading) return;
                await onSubmit(prompt.trim(), mode);
                setPrompt("");
              }}
            >
              <label className="sr-only" htmlFor="orbital-request">Orbital request</label>
              <textarea
                ref={textareaRef}
                id="orbital-request"
                aria-label="Orbital request"
                value={prompt}
                maxLength={4000}
                placeholder={copy.placeholder}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <footer>
                <span>{prompt.length}/4000</span>
                <motion.button
                  type="submit"
                  disabled={!prompt.trim() || loading}
                  aria-label={copy.action}
                  whileHover={!reduceMotion && prompt.trim() && !loading ? { y: -1 } : undefined}
                  whileTap={!reduceMotion && prompt.trim() && !loading ? { y: 0, scale: 0.98 } : undefined}
                >
                  {loading ? "Working" : copy.action}<SendHorizontal aria-hidden="true" size={17} />
                </motion.button>
              </footer>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
      <motion.button
        ref={triggerRef}
        type="button"
        className="orbital-launcher-pill"
        aria-label="Ask Orbital"
        aria-expanded={open}
        onClick={open ? onClose : onOpen}
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
        transition={reduceMotion ? undefined : { duration: 5, repeat: Infinity, ease: "easeInOut" }}
        whileTap={{ scale: 0.96 }}
      >
        <motion.span
          className="orbital-icon-wrapper"
          animate={{ rotate: expanded ? 90 : 0 }}
          transition={reduceMotion ? { duration: 0 } : SPRING_SNAPPY}
        >
          <Sparkles className="orbital-sparkle-icon" aria-hidden="true" size={14} />
          <Orbit aria-hidden="true" size={20} />
        </motion.span>
        <motion.span
          className="orbital-label-wrapper"
          initial={false}
          animate={{ maxWidth: expanded ? 160 : 0, opacity: expanded ? 1 : 0, paddingLeft: expanded ? 8 : 0, paddingRight: expanded ? 4 : 0 }}
          transition={{ duration: 0.32, ease: EASE_OUT_EXPO }}
        >
          <strong>Ask Orbital</strong>
          <small>⌘ J</small>
        </motion.span>
      </motion.button>
    </div>
  );
}
