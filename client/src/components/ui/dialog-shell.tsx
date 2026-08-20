import type { PropsWithChildren, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { SPRING_SNAPPY } from "../../lib/motion";

type DialogShellProps = {
  open: boolean;
  labelledBy: string;
  className?: string;
};

/**
 * Shared backdrop + panel for Orbital's modal dialogs. The panel itself owns
 * no padding: compose it from OverlayHeader / OverlayBody / OverlayFooter so
 * every dialog gets the same sticky header, scrolling body and action row.
 */
export function DialogShell({ open, labelledBy, className = "", children }: PropsWithChildren<DialogShellProps>) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="delete-backdrop"
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.section
            className={`delete-dialog ${className}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={reduceMotion ? { duration: 0.12 } : SPRING_SNAPPY}
          >
            {children}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function OverlayHeader({
  id,
  title,
  kicker,
  subtitle,
  icon,
  onClose,
  closeLabel = "Close",
}: {
  id: string;
  title: ReactNode;
  kicker?: string;
  subtitle?: ReactNode;
  icon?: ReactNode;
  onClose?: () => void;
  closeLabel?: string;
}) {
  return (
    <header className="overlay-head">
      <div className="overlay-head-text">
        {kicker ? <p className="overlay-kicker">{kicker}</p> : null}
        <h2 id={id}>{icon ? <span className="overlay-head-icon">{icon}</span> : null}{title}</h2>
        {subtitle ? <p className="overlay-subtitle">{subtitle}</p> : null}
      </div>
      {onClose ? (
        <button type="button" className="overlay-close" aria-label={closeLabel} onClick={onClose}>
          <X aria-hidden="true" size={17} />
        </button>
      ) : null}
    </header>
  );
}

export function OverlayBody({ children, className = "" }: PropsWithChildren<{ className?: string }>) {
  return <div className={`overlay-body ${className}`.trim()}>{children}</div>;
}

export function OverlayFooter({ children }: PropsWithChildren) {
  return <footer className="overlay-foot">{children}</footer>;
}

export function OverlaySection({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <section className="overlay-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}
