"use client";
import { useCountUp } from "@/lib/hooks/use-count-up";

interface Props {
  value: number;
  className?: string;
  duration?: number;
  loading?: boolean;
}

export function AnimatedCounter({ value, className, duration, loading }: Props) {
  const displayed = useCountUp(value, duration);
  return <span className={className}>{loading ? "—" : displayed}</span>;
}
