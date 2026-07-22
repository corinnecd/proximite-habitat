"use client";

import { ArrowUp, ArrowDown, Minus } from "lucide-react";

export function KpiCard({
  label, value, sub, Icon, iconBg, iconColor, border, trend,
}: {
  label: string; value: string | number; sub?: string;
  Icon: React.ElementType; iconBg: string; iconColor: string; border: string;
  trend?: { delta: number };
}) {
  return (
    <div className={`bg-card/80 backdrop-blur-sm border border-border border-l-4 ${border} rounded-2xl p-5 shadow-sm hover:-translate-y-1.5 hover:shadow-xl transition-all duration-200`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        {trend !== undefined && trend.delta !== 0 && (
          <span className={`flex items-center text-xs font-medium ${trend.delta > 0 ? "text-emerald-600" : "text-red-500"}`}>
            {trend.delta > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {Math.abs(trend.delta)}
          </span>
        )}
        {trend !== undefined && trend.delta === 0 && (
          <span className="flex items-center text-xs text-muted-foreground">
            <Minus className="w-3 h-3" />
          </span>
        )}
      </div>
      <p className="text-2xl sm:text-3xl font-bold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">{label}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-xl px-3 py-2 shadow-lg text-xs space-y-1">
      <p className="font-semibold text-foreground capitalize">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="font-bold ml-auto pl-3">{p.value}</span>
        </div>
      ))}
    </div>
  );
}
