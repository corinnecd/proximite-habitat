"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import { useBranch } from "@/lib/context/branch-context";
import { Calendar, MapPin, Route, ArrowRight, Users } from "lucide-react";

interface VillePlanifiee {
  id: string;
  ville_id: string;
  ville_nom: string;
  code_postal: string;
  chef_equipe: string | null;
}

interface ParcoursInfo {
  nom: string | null;
  distance_m: number | null;
  duration_s: number | null;
  waypoints_count: number;
}

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateFrShort(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function formatKm(m: number | null): string {
  if (m == null) return "—";
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

function formatMin(s: number | null): string {
  if (s == null) return "—";
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rem = min % 60;
  return rem === 0 ? `${h}h` : `${h}h${String(rem).padStart(2, "0")}`;
}

export function PlanificationWidget() {
  const { profile } = useProfile();
  const { selectedBranchId, isDG } = useBranch();
  const supabase = useMemo(() => createClient(), []);

  const currentMonday = useMemo(() => getMondayOfWeek(new Date()), []);
  const sunday = useMemo(() => {
    const d = new Date(currentMonday);
    d.setDate(d.getDate() + 6);
    return d;
  }, [currentMonday]);

  const mondayStr = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${currentMonday.getFullYear()}-${pad(currentMonday.getMonth() + 1)}-${pad(currentMonday.getDate())}`;
  }, [currentMonday]);

  const [villes, setVilles] = useState<VillePlanifiee[]>([]);
  const [parcours, setParcours] = useState<ParcoursInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;

    async function fetchData() {
      if (!profile) return;
      setLoading(true);
      const branchFilter =
        isDG && selectedBranchId !== "all" ? selectedBranchId : profile.organization_id;

      let planQuery = supabase
        .from("planification_hebdo")
        .select("id, ville_id, chef_equipe_id")
        .eq("semaine_du", mondayStr);
      if (branchFilter) planQuery = planQuery.eq("organization_id", branchFilter);

      const parcoursQuery = branchFilter
        ? supabase
            .from("parcours_hebdo")
            .select("nom, distance_m, duration_s, waypoints")
            .eq("organization_id", branchFilter)
            .eq("semaine_du", mondayStr)
            .is("chef_equipe_id", null)
            .maybeSingle()
        : Promise.resolve({ data: null });

      const [planRes, parcRes] = await Promise.all([planQuery, parcoursQuery]);

      if (cancelled) return;

      const rows = planRes.data ?? [];
      if (rows.length === 0) {
        setVilles([]);
      } else {
        const villeIds = [...new Set(rows.map((r) => r.ville_id))];
        const chefIds = [...new Set(rows.filter((r) => r.chef_equipe_id).map((r) => r.chef_equipe_id!))];
        const [villesRes, chefsRes] = await Promise.all([
          supabase.from("zones_villes").select("id, nom, code_postal").in("id", villeIds),
          chefIds.length > 0
            ? supabase.from("profiles").select("id, first_name, last_name").in("id", chefIds)
            : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string }[] }),
        ]);
        if (cancelled) return;
        const villeMap = new Map((villesRes.data ?? []).map((v) => [v.id, v]));
        const chefMap = new Map((chefsRes.data ?? []).map((c) => [c.id, `${c.first_name} ${c.last_name}`]));
        const merged: VillePlanifiee[] = rows.map((r) => {
          const v = villeMap.get(r.ville_id);
          return {
            id: r.id,
            ville_id: r.ville_id,
            ville_nom: v?.nom ?? "—",
            code_postal: v?.code_postal ?? "",
            chef_equipe: r.chef_equipe_id ? chefMap.get(r.chef_equipe_id) ?? null : null,
          };
        }).sort((a, b) => a.ville_nom.localeCompare(b.ville_nom, "fr"));
        setVilles(merged);
      }

      const pd = parcRes.data as {
        nom: string | null;
        distance_m: number | null;
        duration_s: number | null;
        waypoints: [number, number][] | null;
      } | null;
      setParcours(
        pd
          ? {
              nom: pd.nom,
              distance_m: pd.distance_m,
              duration_s: pd.duration_s,
              waypoints_count: (pd.waypoints ?? []).length,
            }
          : null,
      );
      setLoading(false);
    }

    fetchData();
    return () => { cancelled = true; };
  }, [profile, isDG, selectedBranchId, mondayStr, supabase]);

  if (!profile) return null;

  return (
    <section className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-5 sm:p-6 space-y-4">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#F97316]/10 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5 text-[#F97316]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-bold text-foreground">Planification de la semaine</h2>
            <p className="text-xs text-muted-foreground">
              Du {formatDateFrShort(currentMonday)} au {formatDateFrShort(sunday)}
              {" "}·{" "}
              <span className="font-medium">{villes.length}</span> ville{villes.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Link
          href="/planification"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#F97316] hover:underline shrink-0"
        >
          Ouvrir la carte
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Corps */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : villes.length === 0 ? (
        <div className="text-center py-6 space-y-2">
          <MapPin className="w-8 h-8 mx-auto text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">
            Aucune ville planifiée pour cette semaine.
          </p>
          <Link
            href="/planification"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F97316] hover:underline"
          >
            Planifier maintenant
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {villes.map((v) => (
              <div
                key={v.id}
                className="rounded-xl border border-border bg-background/40 px-3.5 py-2.5 space-y-0.5"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <MapPin className="w-3.5 h-3.5 text-[#F97316] shrink-0" />
                  <p className="font-semibold text-sm truncate">{v.ville_nom}</p>
                </div>
                <p className="text-[11px] text-muted-foreground truncate pl-5">
                  {v.code_postal}
                  {v.chef_equipe && (
                    <>
                      {" · "}
                      <Users className="w-3 h-3 inline mr-0.5 mb-0.5" />
                      {v.chef_equipe}
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>

          {parcours && parcours.waypoints_count > 0 && (
            <div className="flex items-center gap-3 rounded-xl bg-[#F97316]/5 border border-[#F97316]/20 px-3.5 py-2.5">
              <Route className="w-4 h-4 text-[#F97316] shrink-0" />
              <div className="text-xs text-foreground flex-1 min-w-0">
                <span className="font-semibold">{parcours.nom ?? "Parcours de tournée"}</span>
                <span className="text-muted-foreground">
                  {" · "}
                  {formatKm(parcours.distance_m)} · {formatMin(parcours.duration_s)} à pied · {parcours.waypoints_count} pts
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
