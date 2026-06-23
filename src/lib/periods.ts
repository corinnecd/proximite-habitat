export type PeriodFilter = "ALL" | "TODAY" | "WEEK" | "MONTH" | "QUARTER" | "SEMESTER" | "YEAR";

export const PERIOD_LABELS: Record<PeriodFilter, string> = {
  ALL: "Toutes les dates",
  TODAY: "Aujourd'hui",
  WEEK: "Cette semaine",
  MONTH: "Ce mois",
  QUARTER: "Ce trimestre",
  SEMESTER: "Ce semestre",
  YEAR: "Cette année",
};

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function getPeriodDates(period: PeriodFilter): { from: string; to: string } | null {
  if (period === "ALL") return null;
  const now = new Date();
  if (period === "TODAY") { const t = fmt(now); return { from: t, to: t }; }
  if (period === "WEEK") {
    const day = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const monday = new Date(now); monday.setDate(now.getDate() - day);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    return { from: fmt(monday), to: fmt(sunday) };
  }
  if (period === "MONTH") {
    return { from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
  }
  if (period === "QUARTER") {
    const q = Math.floor(now.getMonth() / 3);
    return { from: fmt(new Date(now.getFullYear(), q * 3, 1)), to: fmt(new Date(now.getFullYear(), q * 3 + 3, 0)) };
  }
  if (period === "SEMESTER") {
    const sem = now.getMonth() < 6 ? 0 : 1;
    return { from: fmt(new Date(now.getFullYear(), sem * 6, 1)), to: fmt(new Date(now.getFullYear(), sem * 6 + 6, 0)) };
  }
  if (period === "YEAR") {
    return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` };
  }
  return null;
}

const MOIS_NOMS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];

export function getPeriodLabel(period: PeriodFilter): string | null {
  if (period === "ALL") return null;
  const now = new Date();
  if (period === "TODAY") return `${now.getDate()} ${MOIS_NOMS[now.getMonth()]} ${now.getFullYear()}`;
  if (period === "WEEK") {
    const day = now.getDay() === 0 ? 6 : now.getDay() - 1;
    const monday = new Date(now); monday.setDate(now.getDate() - day);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    return `${monday.getDate()} – ${sunday.getDate()} ${MOIS_NOMS[sunday.getMonth()]} ${sunday.getFullYear()}`;
  }
  if (period === "MONTH") return `${MOIS_NOMS[now.getMonth()]} ${now.getFullYear()}`;
  if (period === "QUARTER") {
    const q = Math.floor(now.getMonth() / 3);
    const from = new Date(now.getFullYear(), q * 3, 1);
    const to = new Date(now.getFullYear(), q * 3 + 3, 0);
    return `${from.getDate()} ${MOIS_NOMS[from.getMonth()]} – ${to.getDate()} ${MOIS_NOMS[to.getMonth()]} ${to.getFullYear()}`;
  }
  if (period === "SEMESTER") {
    const sem = now.getMonth() < 6 ? 0 : 1;
    const from = new Date(now.getFullYear(), sem * 6, 1);
    const to = new Date(now.getFullYear(), sem * 6 + 6, 0);
    return `${from.getDate()} ${MOIS_NOMS[from.getMonth()]} – ${to.getDate()} ${MOIS_NOMS[to.getMonth()]} ${to.getFullYear()}`;
  }
  if (period === "YEAR") return `${now.getFullYear()}`;
  return null;
}
