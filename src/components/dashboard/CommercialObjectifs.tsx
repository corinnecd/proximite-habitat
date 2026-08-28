"use client";

import { useEffect, useMemo, useState } from "react";
import { Target, CalendarClock } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface RdvItem {
  id: string;
  reference: string;
  prospect_nom: string;
  prospect_prenom: string;
  prospect_ville: string | null;
  prospect_adresse: string | null;
  heure_visite: string | null;
  status: string;
}

export function CommercialObjectifs({
  profileId, orgId, accepted, ca,
}: {
  profileId: string;
  orgId: string;
  accepted: number;
  ca: number;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [objectif, setObjectif] = useState<{ objectif_fiches: number; objectif_ca: number } | null>(null);

  useEffect(() => {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    supabase
      .from("objectifs_commerciaux")
      .select("objectif_fiches, objectif_ca")
      .eq("commercial_id", profileId)
      .eq("period_month", month)
      // `.single()` renvoie une erreur HTTP 406 quand aucun objectif n'est défini,
      // ce qui polluait la console de chaque commercial à chaque chargement.
      .maybeSingle()
      .then(({ data }) => {
        if (data) setObjectif(data);
      });
  }, [profileId, supabase]);

  if (!objectif) return null;

  const fichePct = objectif.objectif_fiches > 0 ? Math.min(100, Math.round((accepted / objectif.objectif_fiches) * 100)) : 0;
  const caPct = objectif.objectif_ca > 0 ? Math.min(100, Math.round((ca / Number(objectif.objectif_ca)) * 100)) : 0;
  const moisFr = new Date().toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  return (
    <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 hover:shadow-md transition-all duration-200">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center shrink-0">
            <Target className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Mes objectifs — {moisFr}</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Définis par la direction</p>
          </div>
        </div>
        <Link href="/reporting" className="text-xs text-primary hover:text-primary/80 transition-colors">
          Voir le reporting →
        </Link>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Fiches acceptées</span>
            <span className="font-bold">{accepted} / {objectif.objectif_fiches}</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${fichePct >= 100 ? "bg-emerald-500" : fichePct >= 50 ? "bg-blue-500" : "bg-orange-500"}`} style={{ width: `${fichePct}%` }} />
          </div>
          <p className="text-[11px] text-right font-medium tabular-nums">{fichePct}%</p>
        </div>
        <div className="rounded-xl border border-border p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">CA HT</span>
            <span className="font-bold">{ca.toLocaleString("fr-FR", { maximumFractionDigits: 0 })}€ / {Number(objectif.objectif_ca).toLocaleString("fr-FR", { maximumFractionDigits: 0 })}€</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all duration-700 ${caPct >= 100 ? "bg-emerald-500" : caPct >= 50 ? "bg-blue-500" : "bg-orange-500"}`} style={{ width: `${caPct}%` }} />
          </div>
          <p className="text-[11px] text-right font-medium tabular-nums">{caPct}%</p>
        </div>
      </div>
    </div>
  );
}

export function CommercialRdvDuJour({
  profileId,
}: {
  profileId: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [rdvs, setRdvs] = useState<RdvItem[]>([]);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    supabase
      .from("fiches")
      .select("id, reference, prospect_nom, prospect_prenom, prospect_ville, prospect_adresse, heure_visite, status")
      .eq("assigned_to", profileId)
      .eq("rdv_date", today)
      .order("heure_visite", { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        if (data) setRdvs(data as RdvItem[]);
      });
  }, [profileId, supabase]);

  if (rdvs.length === 0) return null;

  return (
    <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 hover:shadow-md transition-all duration-200">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
          <CalendarClock className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">Mes RDV du jour</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">{rdvs.length} rendez-vous aujourd&apos;hui</p>
        </div>
      </div>
      <div className="space-y-2">
        {rdvs.map((rdv) => (
          <Link key={rdv.id} href={`/fiches/${rdv.id}`}>
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border hover:bg-secondary/40 transition-colors cursor-pointer">
              <div className="text-center shrink-0 w-14">
                <p className="text-sm font-bold tabular-nums text-primary">{rdv.heure_visite || "—"}</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{rdv.prospect_prenom} {rdv.prospect_nom}</p>
                <p className="text-xs text-muted-foreground truncate">{rdv.prospect_ville ?? ""}{rdv.prospect_adresse ? ` — ${rdv.prospect_adresse}` : ""}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
