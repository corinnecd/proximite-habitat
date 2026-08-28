"use client";

import { useState, useRef, useCallback } from "react";
import {
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, AlertTriangle, CheckCircle2, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface CsvRow {
  nom: string;
  prenom: string;
  adresse: string;
  cp: string;
  ville: string;
  telephone: string;
  email: string;
}

const EXPECTED_HEADERS = ["nom", "prenom", "adresse", "cp", "ville", "telephone", "email"];
const HEADER_ALIASES: Record<string, string> = {
  "nom": "nom", "name": "nom", "prospect_nom": "nom", "last_name": "nom",
  "prenom": "prenom", "prénom": "prenom", "first_name": "prenom", "prospect_prenom": "prenom",
  "adresse": "adresse", "address": "adresse", "prospect_adresse": "adresse",
  "cp": "cp", "code_postal": "cp", "code postal": "cp", "zip": "cp", "prospect_cp": "cp",
  "ville": "ville", "city": "ville", "prospect_ville": "ville",
  "telephone": "telephone", "téléphone": "telephone", "tel": "telephone", "phone": "telephone", "prospect_telephone": "telephone",
  "email": "email", "e-mail": "email", "mail": "email", "prospect_email": "email",
};

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const sep = lines[0].includes(";") ? ";" : ",";
  const parse = (line: string) => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === sep && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parse(lines[0]).map((h) => h.toLowerCase().replace(/^["']|["']$/g, "").trim());
  const rows = lines.slice(1).map(parse);
  return { headers, rows };
}

function mapHeaders(headers: string[]): Record<number, string> {
  const mapping: Record<number, string> = {};
  for (let i = 0; i < headers.length; i++) {
    const normalized = headers[i].toLowerCase().replace(/[^a-zéè_\s]/g, "").trim();
    const mapped = HEADER_ALIASES[normalized];
    if (mapped) mapping[i] = mapped;
  }
  return mapping;
}

function toRows(headers: string[], rawRows: string[][]): CsvRow[] {
  const mapping = mapHeaders(headers);
  return rawRows
    .filter((r) => r.some((cell) => cell.trim()))
    .map((r) => {
      const row: Record<string, string> = { nom: "", prenom: "", adresse: "", cp: "", ville: "", telephone: "", email: "" };
      for (const [idx, field] of Object.entries(mapping)) {
        row[field] = r[Number(idx)] ?? "";
      }
      return row as unknown as CsvRow;
    })
    .filter((r) => r.nom.trim());
}

interface Props {
  organizationId: string;
  createdBy: string;
  onImported: () => void;
}

export function ImportCsvDialog({ organizationId, createdBy, onImported }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [duplicates, setDuplicates] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [importedCount, setImportedCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setRows([]);
    setSelected(new Set());
    setDuplicates(new Set());
    setStep("upload");
    setImporting(false);
    setImportedCount(0);
  }, []);

  async function handleFile(file: File) {
    const text = await file.text();
    const { headers, rows: rawRows } = parseCsv(text);
    const mapped = toRows(headers, rawRows);
    if (mapped.length === 0) {
      toast.error("Fichier vide ou colonnes non reconnues");
      return;
    }
    setRows(mapped);
    setSelected(new Set(mapped.map((_, i) => i)));
    setStep("preview");

    const supabase = createClient();
    const dupSet = new Set<number>();
    for (let i = 0; i < mapped.length; i++) {
      const r = mapped[i];
      const conditions: string[] = [];
      const tel = r.telephone?.replace(/\s+/g, "");
      if (tel && tel.length >= 6) conditions.push(`prospect_telephone.eq.${tel}`);
      if (r.nom && r.cp) conditions.push(`and(prospect_nom.ilike.%${r.nom.trim()}%,prospect_cp.eq.${r.cp.trim()})`);
      if (conditions.length === 0) continue;
      const { data } = await supabase
        .from("fiches")
        .select("id")
        .or(conditions.join(","))
        .limit(1);
      if (data && data.length > 0) dupSet.add(i);
    }
    setDuplicates(dupSet);
    if (dupSet.size > 0) {
      setSelected((prev) => {
        const next = new Set(prev);
        dupSet.forEach((i) => next.delete(i));
        return next;
      });
    }
  }

  async function handleImport() {
    setImporting(true);
    const supabase = createClient();
    let count = 0;

    const toInsert = rows
      .filter((_, i) => selected.has(i))
      .map((r) => ({
        organization_id: organizationId,
        created_by: createdBy,
        status: "SOUMISE" as const,
        prospect_nom: r.nom.trim(),
        prospect_prenom: r.prenom.trim() || null,
        prospect_adresse: r.adresse.trim() || null,
        prospect_cp: r.cp.trim() || null,
        prospect_ville: r.ville.trim() || null,
        prospect_telephone: r.telephone.trim() || null,
        prospect_email: r.email.trim() || null,
      }));

    const BATCH = 20;
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const batch = toInsert.slice(i, i + BATCH);
      const { error } = await supabase.from("fiches").insert(batch);
      if (error) {
        toast.error(`Erreur à la ligne ${i + 1} : ${error.message}`);
        break;
      }
      count += batch.length;
    }

    setImportedCount(count);
    setStep("done");
    setImporting(false);
    if (count > 0) {
      toast.success(`${count} fiche${count > 1 ? "s" : ""} importée${count > 1 ? "s" : ""}`);
      onImported();
    }
  }

  function toggleRow(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === rows.length) setSelected(new Set());
    else setSelected(new Set(rows.map((_, i) => i)));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger render={
        <Button variant="outline" size="sm" className="gap-1.5">
          <Upload className="w-3.5 h-3.5" /><span className="hidden sm:inline">Import CSV</span><span className="sr-only sm:hidden">Importer un CSV</span>
        </Button>
      } />
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Importer des prospects (CSV)</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Sélectionnez un fichier CSV avec les colonnes : nom, prénom, adresse, cp, ville, téléphone, email"}
            {step === "preview" && `${rows.length} ligne${rows.length > 1 ? "s" : ""} détectée${rows.length > 1 ? "s" : ""} — ${selected.size} sélectionnée${selected.size > 1 ? "s" : ""}`}
            {step === "done" && `${importedCount} fiche${importedCount > 1 ? "s" : ""} importée${importedCount > 1 ? "s" : ""} avec succès`}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
          >
            <FileText className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Glissez un fichier CSV ici</p>
            <p className="text-xs text-muted-foreground mt-1">ou cliquez pour parcourir</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
        )}

        {step === "preview" && (
          <div className="flex-1 overflow-auto -mx-5 px-5">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2 px-1 text-left w-8">
                      <input type="checkbox" checked={selected.size === rows.length} onChange={toggleAll} className="rounded" />
                    </th>
                    <th className="py-2 px-1 text-left text-muted-foreground font-semibold">#</th>
                    <th className="py-2 px-1 text-left text-muted-foreground font-semibold">Nom</th>
                    <th className="py-2 px-1 text-left text-muted-foreground font-semibold">Prénom</th>
                    <th className="py-2 px-1 text-left text-muted-foreground font-semibold">CP</th>
                    <th className="py-2 px-1 text-left text-muted-foreground font-semibold">Ville</th>
                    <th className="py-2 px-1 text-left text-muted-foreground font-semibold">Tél</th>
                    <th className="py-2 px-1 text-left text-muted-foreground font-semibold">État</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr
                      key={i}
                      className={`border-b border-border/50 ${duplicates.has(i) ? "bg-orange-50 dark:bg-orange-950/20" : ""} ${!selected.has(i) ? "opacity-50" : ""}`}
                    >
                      <td className="py-1.5 px-1">
                        <input type="checkbox" checked={selected.has(i)} onChange={() => toggleRow(i)} className="rounded" />
                      </td>
                      <td className="py-1.5 px-1 tabular-nums text-muted-foreground">{i + 1}</td>
                      <td className="py-1.5 px-1 font-medium">{r.nom}</td>
                      <td className="py-1.5 px-1">{r.prenom}</td>
                      <td className="py-1.5 px-1 tabular-nums">{r.cp}</td>
                      <td className="py-1.5 px-1">{r.ville}</td>
                      <td className="py-1.5 px-1 tabular-nums">{r.telephone}</td>
                      <td className="py-1.5 px-1">
                        {duplicates.has(i) ? (
                          <span className="inline-flex items-center gap-1 text-orange-600 text-[10px] font-medium">
                            <AlertTriangle className="w-3 h-3" />Doublon
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-600 text-[10px] font-medium">
                            <CheckCircle2 className="w-3 h-3" />OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {duplicates.size > 0 && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 p-3 text-xs text-orange-700 dark:text-orange-400">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{duplicates.size} doublon{duplicates.size > 1 ? "s" : ""} détecté{duplicates.size > 1 ? "s" : ""} (désélectionné{duplicates.size > 1 ? "s" : ""} par défaut). Vous pouvez les resélectionner si besoin.</span>
              </div>
            )}
          </div>
        )}

        {step === "done" && (
          <div className="text-center py-6">
            <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-500 mb-3" />
            <p className="text-lg font-semibold">{importedCount} fiche{importedCount > 1 ? "s" : ""} importée{importedCount > 1 ? "s" : ""}</p>
            <p className="text-sm text-muted-foreground mt-1">Les fiches sont créées en statut &laquo; Soumise &raquo;</p>
          </div>
        )}

        <DialogFooter>
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={reset}>Annuler</Button>
              <Button onClick={handleImport} disabled={importing || selected.size === 0}>
                {importing ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Import en cours…</> : `Importer ${selected.size} fiche${selected.size > 1 ? "s" : ""}`}
              </Button>
            </>
          )}
          {step === "done" && (
            <Button onClick={() => { setOpen(false); reset(); }}>Fermer</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
