"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
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
