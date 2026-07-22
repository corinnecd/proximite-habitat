"use client";

import { Target, Pencil, Save } from "lucide-react";

interface CommercialRow { id: string; name: string; assigned: number; accepted: number; refused: number; rate: number; ca: number; }

export function ObjectifsSection({
  commerciaux, objectifs, isCommercial, isAdminOrDG, profileId,
  editingObjectifs, setEditingObjectifs, objDraft, setObjDraft,
  savingObjectifs, startEditingObjectifs, saveObjectifs,
}: {
  commerciaux: CommercialRow[];
  objectifs: Record<string, { objectif_fiches: number; objectif_ca: number }>;
  isCommercial: boolean;
  isAdminOrDG: boolean;
  profileId?: string;
  editingObjectifs: boolean;
  setEditingObjectifs: (v: boolean) => void;
  objDraft: Record<string, { fiches: string; ca: string }>;
  setObjDraft: React.Dispatch<React.SetStateAction<Record<string, { fiches: string; ca: string }>>>;
  savingObjectifs: boolean;
  startEditingObjectifs: () => void;
  saveObjectifs: () => void;
}) {
  return (
    <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 hover:shadow-md transition-all duration-200">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
            <Target className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Objectifs du mois</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" })} — {isCommercial ? "Mon objectif" : "par commercial"}
            </p>
          </div>
        </div>
        {isAdminOrDG && !editingObjectifs && (
          <button
            type="button"
            onClick={startEditingObjectifs}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />Configurer
          </button>
        )}
        {isAdminOrDG && editingObjectifs && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditingObjectifs(false)}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={saveObjectifs}
              disabled={savingObjectifs}
              className="flex items-center gap-1.5 text-xs font-medium text-white bg-primary hover:bg-primary/90 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />{savingObjectifs ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        )}
      </div>

      {isCommercial && profileId ? (() => {
        const obj = objectifs[profileId];
        const myComm = commerciaux.find((c) => c.id === profileId);
        if (!obj) return (
          <p className="text-sm text-muted-foreground text-center py-4">Aucun objectif défini pour ce mois</p>
        );
        const fichePct = obj.objectif_fiches > 0 ? Math.min(100, Math.round(((myComm?.accepted ?? 0) / obj.objectif_fiches) * 100)) : 0;
        const caPct = obj.objectif_ca > 0 ? Math.min(100, Math.round(((myComm?.ca ?? 0) / Number(obj.objectif_ca)) * 100)) : 0;
        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Fiches acceptées</span>
                <span className="font-bold">{myComm?.accepted ?? 0} / {obj.objectif_fiches}</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${fichePct >= 100 ? "bg-emerald-500" : fichePct >= 50 ? "bg-blue-500" : "bg-orange-500"}`} style={{ width: `${fichePct}%` }} />
              </div>
              <p className="text-[11px] text-right font-medium tabular-nums">{fichePct}%</p>
            </div>
            <div className="rounded-xl border border-border p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">CA HT</span>
                <span className="font-bold">{(myComm?.ca ?? 0).toLocaleString("fr-FR", { maximumFractionDigits: 0 })}€ / {Number(obj.objectif_ca).toLocaleString("fr-FR", { maximumFractionDigits: 0 })}€</span>
              </div>
              <div className="h-3 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${caPct >= 100 ? "bg-emerald-500" : caPct >= 50 ? "bg-blue-500" : "bg-orange-500"}`} style={{ width: `${caPct}%` }} />
              </div>
              <p className="text-[11px] text-right font-medium tabular-nums">{caPct}%</p>
            </div>
          </div>
        );
      })() : (
        <div>
          <div className="grid grid-cols-[1fr_80px_80px_60px_80px_60px] gap-2 text-[10px] text-muted-foreground uppercase tracking-wide font-semibold pb-2 border-b border-border">
            <span>Commercial</span>
            <span className="text-right">Obj. fiches</span>
            <span className="text-right">Obj. CA</span>
            <span className="text-right">Accept.</span>
            <span className="text-right">CA réel</span>
            <span className="text-right">Atteinte</span>
          </div>
          <div className="space-y-0 max-h-[350px] overflow-y-auto">
            {commerciaux.map((c) => {
              const obj = objectifs[c.id];
              const fichePct = obj && obj.objectif_fiches > 0 ? Math.min(999, Math.round((c.accepted / obj.objectif_fiches) * 100)) : null;
              return (
                <div key={c.id} className="grid grid-cols-[1fr_80px_80px_60px_80px_60px] gap-2 items-center py-2 hover:bg-secondary/30 rounded-lg px-1 transition-colors">
                  <span className="text-sm font-medium truncate">{c.name}</span>
                  {editingObjectifs ? (
                    <>
                      <input
                        type="number"
                        min={0}
                        value={objDraft[c.id]?.fiches ?? ""}
                        onChange={(e) => setObjDraft((d) => ({ ...d, [c.id]: { ...d[c.id], fiches: e.target.value } }))}
                        placeholder="0"
                        className="w-full text-right text-sm tabular-nums px-2 py-1 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                      <input
                        type="number"
                        min={0}
                        value={objDraft[c.id]?.ca ?? ""}
                        onChange={(e) => setObjDraft((d) => ({ ...d, [c.id]: { ...d[c.id], ca: e.target.value } }))}
                        placeholder="0"
                        className="w-full text-right text-sm tabular-nums px-2 py-1 rounded-lg border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
                      />
                    </>
                  ) : (
                    <>
                      <span className="text-sm text-right tabular-nums text-muted-foreground">{obj?.objectif_fiches ?? "—"}</span>
                      <span className="text-sm text-right tabular-nums text-muted-foreground">{obj ? Number(obj.objectif_ca).toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + "€" : "—"}</span>
                    </>
                  )}
                  <span className="text-sm text-right tabular-nums text-emerald-600 font-medium">{c.accepted}</span>
                  <span className="text-sm text-right tabular-nums text-amber-600 font-medium">{c.ca > 0 ? c.ca.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + "€" : "—"}</span>
                  <span className="text-right">
                    {fichePct !== null ? (
                      <span className={`text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-full ${fichePct >= 100 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" : fichePct >= 50 ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" : "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400"}`}>
                        {fichePct}%
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
