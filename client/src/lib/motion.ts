import type { Transition, Variants } from "framer-motion";

/**
 * Orbital's shared motion grammar: one exponential ease-out curve, one
 * spring, used everywhere instead of ad-hoc per-component easings.
 */
export const EASE_OUT_EXPO: Transition["ease"] = [0.16, 1, 0.3, 1];

export const SPRING_SNAPPY: Transition = { type: "spring", stiffness: 420, damping: 34, mass: 0.9 };
export const SPRING_SOFT: Transition = { type: "spring", stiffness: 260, damping: 30, mass: 1 };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT_EXPO } },
};

export const staggerChildren = (stagger = 0.05, delay = 0): Variants => ({
  hidden: {},
  show: {
    transition: { staggerChildren: stagger, delayChildren: delay },
  },
});

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: EASE_OUT_EXPO } },
};
