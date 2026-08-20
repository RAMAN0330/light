import type { PropsWithChildren } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { SPRING_SNAPPY } from "../../lib/motion";

type DialogShellProps = {
  open: boolean;
  labelledBy: string;
  className?: string;
};

/**
 * Shared backdrop + panel motion for Orbital's modal dialogs. Keeps the
 * existing .delete-backdrop / .delete-dialog visual language; only adds a
 * proper enter/exit transition in place of the old mount/unmount snap.
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
