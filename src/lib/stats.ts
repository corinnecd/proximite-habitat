import type { FicheStatus } from "@/types/database";

// Agrégation des fiches par période, côté client (aucune dépendance externe).
// Le regroupement se fait en heure locale à partir du champ `created_at`.

export type Granularity = "week" | "month" | "quarter" | "semester" | "year";

export const GRANULARITIES: Granularity[] = ["week", "month", "quarter", "semester", "year"];

export const GRANULARITY_LABELS: Record<Granularity, string> = {
  week: "Hebdomadaire",
  month: "Mensuel",
  quarter: "Trimestriel",
  semester: "Semestriel",
  year: "Annuel",
};

/** Libellé de la période courante (ex. « ce mois-ci »). */
export const CURRENT_PERIOD_LABELS: Record<Granularity, string> = {
  week: "cette semaine",
  month: "ce mois-ci",
  quarter: "ce trimestre",
  semester: "ce semestre",
  year: "cette année",
};

/** Nombre de tranches affichées par défaut sur la courbe d'évolution. */
export const DEFAULT_BUCKET_COUNT: Record<Granularity, number> = {
  week: 12,
  month: 12,
  quarter: 8,
  semester: 6,
  year: 5,
};

export type StatPoint = { created_at: string; status: FicheStatus };

export type PeriodBucket = {
  key: string;
  start: Date;
  label: string;
  total: number;
  submitted: number; // hors BROUILLON
  accepted: number;
  refused: number;
};

// ── Bornes de période (heure locale) ─────────────────────────────────────────

function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayMondayFirst = (x.getDay() + 6) % 7; // lundi = 0 … dimanche = 6
  x.setDate(x.getDate() - dayMondayFirst);
  return x;
}

export function bucketStart(d: Date, g: Granularity): Date {
  switch (g) {
    case "week":
      return startOfWeek(d);
    case "month":
      return new Date(d.getFullYear(), d.getMonth(), 1);
    case "quarter":
      return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
    case "semester":
      return new Date(d.getFullYear(), d.getMonth() < 6 ? 0 : 6, 1);
    case "year":
      return new Date(d.getFullYear(), 0, 1);
  }
}

export function prevBucketStart(start: Date, g: Granularity): Date {
  switch (g) {
    case "week":
      return new Date(start.getFullYear(), start.getMonth(), start.getDate() - 7);
    case "month":
      return new Date(start.getFullYear(), start.getMonth() - 1, 1);
    case "quarter":
      return new Date(start.getFullYear(), start.getMonth() - 3, 1);
    case "semester":
      return new Date(start.getFullYear(), start.getMonth() - 6, 1);
    case "year":
      return new Date(start.getFullYear() - 1, 0, 1);
  }
}

function bucketLabel(start: Date, g: Granularity): string {
  const yy = String(start.getFullYear()).slice(2);
  switch (g) {
    case "week":
      // Début de semaine, ex. « 12 mai »
      return start.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
    case "month":
      return start.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
    case "quarter":
      return `T${Math.floor(start.getMonth() / 3) + 1} ${yy}`;
    case "semester":
      return `${start.getMonth() < 6 ? "1er" : "2e"} sem. ${yy}`;
    case "year":
      return String(start.getFullYear());
  }
}

/** Clé unique et triable d'une tranche (date de début au format AAAA-MM-JJ local). */
function bucketKey(start: Date): string {
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, "0");
  const d = String(start.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function emptyBucket(start: Date, g: Granularity): PeriodBucket {
  return { key: bucketKey(start), start, label: bucketLabel(start, g), total: 0, submitted: 0, accepted: 0, refused: 0 };
}

function accumulate(bucket: PeriodBucket, status: FicheStatus): void {
  bucket.total += 1;
  if (status !== "BROUILLON") bucket.submitted += 1;
  if (status === "ACCEPTEE") bucket.accepted += 1;
  if (status === "REFUSEE") bucket.refused += 1;
}

/**
 * Construit les `count` dernières tranches (jusqu'à la période courante incluse)
 * pour la granularité demandée, en y ventilant les fiches.
 */
export function buildBuckets(
  rows: StatPoint[],
  g: Granularity,
  count: number = DEFAULT_BUCKET_COUNT[g],
): PeriodBucket[] {
  // Tranches attendues (de la plus ancienne à la plus récente)
  const starts: Date[] = [];
  let cursor = bucketStart(new Date(), g);
  for (let i = 0; i < count; i++) {
    starts.unshift(cursor);
    cursor = prevBucketStart(cursor, g);
  }

  const byKey = new Map<string, PeriodBucket>();
  for (const start of starts) {
    const b = emptyBucket(start, g);
    byKey.set(b.key, b);
  }

  for (const row of rows) {
    const start = bucketStart(new Date(row.created_at), g);
    const bucket = byKey.get(bucketKey(start));
    if (bucket) accumulate(bucket, row.status); // ignore les fiches hors fenêtre
  }

  return starts.map((s) => byKey.get(bucketKey(s))!);
}

/** Taux de conversion (acceptées / soumises), en %, arrondi. */
export function conversionRate(bucket: { submitted: number; accepted: number }): number {
  return bucket.submitted > 0 ? Math.round((bucket.accepted / bucket.submitted) * 100) : 0;
}

/** Stats de la période courante et de la précédente (pour afficher une évolution). */
export function currentAndPreviousPeriod(
  rows: StatPoint[],
  g: Granularity,
): { current: PeriodBucket; previous: PeriodBucket } {
  const currentStart = bucketStart(new Date(), g);
  const previousStart = prevBucketStart(currentStart, g);
  const current = emptyBucket(currentStart, g);
  const previous = emptyBucket(previousStart, g);

  for (const row of rows) {
    const start = bucketStart(new Date(row.created_at), g);
    const key = bucketKey(start);
    if (key === current.key) accumulate(current, row.status);
    else if (key === previous.key) accumulate(previous, row.status);
  }

  return { current, previous };
}
