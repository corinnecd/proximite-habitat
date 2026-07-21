// Utilitaires purs pour la vue "Calendrier des RDV" (mois / semaine).
// Semaine = lundi -> dimanche (cohérent avec lib/periods.ts et planification/page.tsx).

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Lundi de la semaine contenant `date`. */
export function getMondayOfWeek(date: Date): Date {
  const d = startOfDay(date);
  const day = d.getDay(); // 0 = dimanche, 1 = lundi, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/** Les 7 jours (lundi -> dimanche) de la semaine contenant `date`. */
export function getWeekDays(date: Date): Date[] {
  const monday = getMondayOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

/**
 * Grille du mois de `date`, sous forme de semaines de 7 jours (lundi -> dimanche).
 * Inclut les jours des mois adjacents nécessaires pour compléter la première
 * et la dernière semaine.
 */
export function getMonthGrid(date: Date): Date[][] {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const lastOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

  const gridStart = getMondayOfWeek(firstOfMonth);
  const gridEnd = getWeekDays(lastOfMonth)[6];

  const weeks: Date[][] = [];
  let cursor = new Date(gridStart);
  while (cursor <= gridEnd) {
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(cursor);
      d.setDate(cursor.getDate() + i);
      return d;
    });
    weeks.push(week);
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 7);
  }
  return weeks;
}

/** Clé jour au format YYYY-MM-DD (même convention que rdv_date en base). */
export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(1); // évite les débordements de fin de mois (ex: 31 janvier + 1 mois)
  d.setMonth(d.getMonth() + n);
  return d;
}

export function addWeeks(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n * 7);
  return d;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
