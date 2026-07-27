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
  if (loading) return <span className={`inline-block h-6 w-10 bg-muted rounded animate-pulse align-middle ${className ?? ""}`} />;
  return <span className={className}>{displayed}</span>;
}
