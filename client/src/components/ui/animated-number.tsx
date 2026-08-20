import { useEffect, useRef } from "react";
import { animate, useMotionValue, useReducedMotion, useTransform } from "framer-motion";

export function AnimatedNumber({ value }: { value: number }) {
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(0);
  const rounded = useTransform(motionValue, (latest) => Math.round(latest).toLocaleString());
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reduceMotion) {
      motionValue.set(value);
      return;
    }
    const controls = animate(motionValue, value, { duration: 0.7, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [value, motionValue, reduceMotion]);

  useEffect(() => rounded.on("change", (latest) => {
    if (ref.current) ref.current.textContent = latest;
  }), [rounded]);

  return <span ref={ref}>0</span>;
}
