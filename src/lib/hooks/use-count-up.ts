"use client";
import { useEffect, useRef, useState } from "react";

export function useCountUp(target: number, duration = 600): number {
  const [displayed, setDisplayed] = useState(target);
  const displayedRef = useRef(target);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const from = displayedRef.current;
    if (from === target) return;
    startRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const animate = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(from + (target - from) * eased);
      displayedRef.current = next;
      setDisplayed(next);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return displayed;
}
