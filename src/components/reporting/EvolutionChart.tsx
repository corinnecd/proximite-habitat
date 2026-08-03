"use client";

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from "recharts";
import { ChevronDown } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

export type Granularity = "week" | "month" | "quarter" | "semester" | "year";

const GRANULARITY_LABELS: Record<Granularity, string> = {
  week: "Semaine",
  month: "Mois",
  quarter: "Trimestre",
  semester: "Semestre",
  year: "Année",
};

export interface LineConfig {
  dataKey: string;
  label: string;
  color: string;
  yAxisId?: "left" | "right";
  formatter?: (v: number) => string;
}

interface PersonOption {
  id: string;
  name: string;
}

interface EvolutionChartProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  iconBg: string;
  data: Record<string, unknown>[];
  lines: LineConfig[];
  persons: PersonOption[];
  selectedPerson: string;
  onPersonChange: (id: string) => void;
  allLabel?: string;
  dualAxis?: boolean;
  rightAxisFormatter?: (v: number) => string;
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
  hidePersonSelector?: boolean;
  showZeroLine?: boolean;
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({
  active, payload, label, lines,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string; dataKey: string; payload: Record<string, unknown> }>;
  label?: string;
  lines: LineConfig[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-xl px-3 py-2 shadow-lg text-xs space-y-1.5">
      <p className="font-semibold text-foreground capitalize">{label}</p>
      {payload.map((p) => {
        const cfg = lines.find((l) => l.dataKey === p.dataKey);
        const formatted = cfg?.formatter ? cfg.formatter(p.value) : String(p.value);
        const evolKey = `${p.dataKey}Evol`;
        const evolValue = p.payload[evolKey];
        return (
          <div key={p.name} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="font-bold ml-auto pl-3">{formatted}</span>
            {typeof evolValue === "number" && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                evolValue > 0
                  ? "text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/40"
                  : evolValue < 0
                    ? "text-red-700 bg-red-100 dark:text-red-300 dark:bg-red-900/40"
                    : "text-muted-foreground bg-muted"
              }`}>
                {evolValue > 0 ? "+" : ""}{evolValue}%
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function EvolutionChart({
  title, subtitle, icon, iconBg, data, lines,
  persons, selectedPerson, onPersonChange, allLabel = "Tous",
  dualAxis = false, rightAxisFormatter,
  granularity, onGranularityChange,
  hidePersonSelector = false, showZeroLine = false,
}: EvolutionChartProps) {

  return (
    <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 hover:shadow-md transition-all duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-sm">{title}</h3>
            {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
        </div>

        {/* Dropdown personne */}
        {!hidePersonSelector && (
          <div className="relative w-full sm:w-52 shrink-0">
            <select
              value={selectedPerson}
              onChange={(e) => onPersonChange(e.target.value)}
              className="w-full appearance-none pl-3 pr-8 py-1.5 text-xs rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer"
            >
              <option value="all">{allLabel}</option>
              {persons.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
        )}
      </div>

      {/* Granularity pills */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {(Object.keys(GRANULARITY_LABELS) as Granularity[]).map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => onGranularityChange(g)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              granularity === g
                ? "bg-[#1E3A5F] text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80 border border-border"
            }`}
          >
            {GRANULARITY_LABELS[g]}
          </button>
        ))}
      </div>

      {/* Chart */}
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée disponible</p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data} margin={{ top: 5, right: dualAxis ? 10 : 10, left: -20, bottom: 0 }}>
            <defs>
              {lines.map((line) => (
                <linearGradient key={`grad-${line.dataKey}`} id={`grad-${line.dataKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={line.color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={line.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={data.length > 12 ? "preserveStartEnd" : 0} />
            {dualAxis ? (
              <>
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis
                  yAxisId="right" orientation="right"
                  tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={rightAxisFormatter ?? ((v: number) => `${(v / 1000).toFixed(0)}k€`)}
                />
              </>
            ) : (
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
            )}
            <Tooltip content={<ChartTooltip lines={lines} />} />
            {showZeroLine && <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.35} strokeDasharray="4 4" />}
            {lines.map((line) => (
              <Area
                key={line.dataKey}
                type="monotone"
                dataKey={line.dataKey}
                name={line.label}
                stroke={line.color}
                strokeWidth={2}
                fill={`url(#grad-${line.dataKey})`}
                animationDuration={700}
                yAxisId={dualAxis ? (line.yAxisId ?? "left") : undefined}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 pt-3 text-xs text-muted-foreground">
        {lines.map((line) => (
          <span key={line.dataKey} className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: line.color }} />
            {line.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Bucketing utility ──────────────────────────────────────────────────────────

interface FicheForBucket {
  created_by: string;
  assigned_to: string | null;
  status: string;
  montant_ht: number | null;
  created_at: string;
}

function getWeekMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - (day === 0 ? 6 : day - 1);
  return new Date(d.getFullYear(), d.getMonth(), diff);
}

function fmtDate(d: Date, opts: Intl.DateTimeFormatOptions): string {
  return d.toLocaleDateString("fr-FR", opts);
}

function generatePeriods(granularity: Granularity, fiches: FicheForBucket[]): { start: Date; end: Date; label: string }[] {
  const now = new Date();
  const periods: { start: Date; end: Date; label: string }[] = [];

  let earliest: Date | null = null;
  for (const f of fiches) {
    const d = new Date(f.created_at);
    if (!earliest || d < earliest) earliest = d;
  }
  if (!earliest) earliest = now;

  if (granularity === "week") {
    const firstMonday = getWeekMonday(new Date(earliest.getFullYear(), 0, 1)); // semaine ISO contenant le 1er janvier
    const currentMonday = getWeekMonday(now);
    const diffWeeks = Math.round((currentMonday.getTime() - firstMonday.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const count = diffWeeks + 1;
    for (let i = count - 1; i >= 0; i--) {
      const monday = getWeekMonday(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7));
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() + 6);
      const end = new Date(monday);
      end.setDate(end.getDate() + 7);
      periods.push({
        start: monday,
        end,
        label: `${fmtDate(monday, { day: "2-digit", month: "short" })} - ${fmtDate(sunday, { day: "2-digit", month: "short" })}`,
      });
    }
  } else if (granularity === "month") {
    const firstMonth = new Date(earliest.getFullYear(), 0, 1); // janvier de l'année calendaire
    const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const diffMonths = (currentMonth.getFullYear() - firstMonth.getFullYear()) * 12 + (currentMonth.getMonth() - firstMonth.getMonth());
    const count = diffMonths + 1;
    for (let i = count - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      periods.push({
        start,
        end,
        label: fmtDate(start, { month: "short", year: "numeric" }),
      });
    }
  } else if (granularity === "quarter") {
    const firstQYear = earliest.getFullYear(); // ancré sur T1 de l'année calendaire
    const currentQ = Math.floor(now.getMonth() / 3);
    const currentQYear = now.getFullYear();
    const diffQ = (currentQYear - firstQYear) * 4 + currentQ;
    const count = diffQ + 1;
    for (let i = count - 1; i >= 0; i--) {
      const totalQ = currentQYear * 4 + currentQ - i;
      const qYear = Math.floor(totalQ / 4);
      const qIdx = totalQ % 4;
      const startMonth = qIdx * 3;
      const start = new Date(qYear, startMonth, 1);
      const end = new Date(qYear, startMonth + 3, 1);
      periods.push({
        start,
        end,
        label: `T${qIdx + 1} ${qYear}`,
      });
    }
  } else if (granularity === "semester") {
    const firstSYear = earliest.getFullYear(); // ancré sur S1 de l'année calendaire
    const currentS = Math.floor(now.getMonth() / 6);
    const currentSYear = now.getFullYear();
    const diffS = (currentSYear - firstSYear) * 2 + currentS;
    const count = diffS + 1;
    for (let i = count - 1; i >= 0; i--) {
      const totalS = currentSYear * 2 + currentS - i;
      const sYear = Math.floor(totalS / 2);
      const sIdx = totalS % 2;
      const startMonth = sIdx * 6;
      const start = new Date(sYear, startMonth, 1);
      const end = new Date(sYear, startMonth + 6, 1);
      periods.push({
        start,
        end,
        label: `S${sIdx + 1} ${sYear}`,
      });
    }
  } else {
    const firstYear = earliest.getFullYear();
    const currentYear = now.getFullYear();
    const count = Math.max(3, currentYear - firstYear + 1);
    for (let i = count - 1; i >= 0; i--) {
      const year = now.getFullYear() - i;
      periods.push({
        start: new Date(year, 0, 1),
        end: new Date(year + 1, 0, 1),
        label: String(year),
      });
    }
  }

  return periods;
}

export function bucketReferentFiches(
  fiches: FicheForBucket[],
  granularity: Granularity,
  selectedPerson: string,
): Record<string, unknown>[] {
  const filtered = selectedPerson === "all" ? fiches : fiches.filter((f) => f.created_by === selectedPerson);
  const periods = generatePeriods(granularity, filtered);
  return periods.map((p) => {
    let count = 0;
    for (const f of filtered) {
      const d = new Date(f.created_at);
      if (d >= p.start && d < p.end) count++;
    }
    return { label: p.label, fiches: count };
  });
}

export function bucketCommercialVentes(
  fiches: FicheForBucket[],
  granularity: Granularity,
  selectedPerson: string,
): Record<string, unknown>[] {
  const filtered = selectedPerson === "all"
    ? fiches.filter((f) => f.status === "ACCEPTEE" && f.assigned_to)
    : fiches.filter((f) => f.status === "ACCEPTEE" && f.assigned_to === selectedPerson);
  const periods = generatePeriods(granularity, filtered);
  const buckets = periods.map((p) => {
    let ventes = 0;
    let ca = 0;
    for (const f of filtered) {
      const d = new Date(f.created_at);
      if (d >= p.start && d < p.end) {
        ventes++;
        ca += Number(f.montant_ht ?? 0);
      }
    }
    return { label: p.label, ventes, ca };
  });

  return buckets.map((bucket, i) => {
    if (i === 0) return { ...bucket, ventesEvol: null, caEvol: null };
    const prev = buckets[i - 1];
    const ventesEvol = prev.ventes === 0 ? null : Math.round(((bucket.ventes - prev.ventes) / prev.ventes) * 100);
    const caEvol = prev.ca === 0 ? null : Math.round(((bucket.ca - prev.ca) / prev.ca) * 100);
    return { ...bucket, ventesEvol, caEvol };
  });
}
