import { useEffect, useRef, type RefObject } from "react";
import Lenis from "lenis";

/**
 * Attaches momentum smooth-scroll to a specific scroll container (Orbital's
 * panels scroll internally, not the window). No-ops under
 * prefers-reduced-motion so the container falls back to native scrolling.
 */
export function useLenis<T extends HTMLElement>(ref: RefObject<T | null>) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    const wrapper = ref.current;
    if (!wrapper) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      wrapper,
      content: wrapper,
      duration: 1.05,
      smoothWheel: true,
      syncTouch: false,
    });
    lenisRef.current = lenis;

    let frame: number;
    const raf = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(raf);
    };
    frame = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [ref]);

  return lenisRef;
}
