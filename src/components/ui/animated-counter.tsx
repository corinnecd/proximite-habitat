"use client";
import { useCountUp } from "@/lib/hooks/use-count-up";

interface Props {
  value: number;
  className?: string;
  duration?: number;
}

export function AnimatedCounter({ value, className, duration }: Props) {
  const displayed = useCountUp(value, duration);
  return <span className={className}>{displayed}</span>;
}
