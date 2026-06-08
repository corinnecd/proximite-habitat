/** Colonne d'export : clé de l'objet source + libellé affiché en en-tête. */
export type CsvColumn<T> = { key: keyof T; label: string };

/**
 * Construit un CSV (séparateur `;`, compatible Excel FR) à partir de lignes.
 * Les valeurs contenant `;`, `"`, retour-ligne sont échappées par des guillemets.
 */
export function toCsv<T extends Record<string, unknown>>(columns: CsvColumn<T>[], rows: T[]): string {
  const escape = (value: unknown): string => {
    const s = value == null ? "" : String(value);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = columns.map((c) => escape(c.label)).join(";");
  const lines = rows.map((row) => columns.map((c) => escape(row[c.key])).join(";"));
  return [header, ...lines].join("\r\n");
}

/** Déclenche le téléchargement d'un fichier CSV (préfixé d'un BOM UTF-8 pour Excel). */
export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
