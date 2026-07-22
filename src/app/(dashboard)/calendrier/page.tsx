"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Clock, MapPin, Phone, Search, X, User } from "lucide-react";
import Link from "next/link";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FicheStatusBadge } from "@/components/fiches/FicheStatusBadge";
import { RdvEditDialog } from "@/components/fiches/RdvEditDialog";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import { useBranch } from "@/lib/context/branch-context";
import {
  addMonths,
  addWeeks,
  getMonthGrid,
  getWeekDays,
  isSameDay,
  toDateKey,
} from "@/lib/calendar";
import type { FicheStatus } from "@/types/database";

const MOIS_NOMS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const JOURS_ENTETE = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

type ViewMode = "month" | "week";

interface ProfileOption { id: string; first_name: string; last_name: string; }

interface RdvFiche {
  id: string;
  reference: string;
  status: FicheStatus;
  rdv_date: string;
  heure_visite: string | null;
  prospect_nom: string | null;
  prospect_prenom: string | null;
  prospect_adresse: string | null;
  prospect_ville: string | null;
  prospect_telephone: string | null;
  organization_id: string;
  assigned_to_profile: { first_name: string; last_name: string } | null;
}

function formatMonthLabel(date: Date): string {
  return `${MOIS_NOMS[date.getMonth()]} ${date.getFullYear()}`;
}

function fullName(p: { first_name: string; last_name: string } | null): string | null {
  if (!p) return null;
  return `${p.first_name} ${p.last_name}`;
}

export default function CalendrierPage() {
  const { profile } = useProfile();
  const { selectedBranchId, isDG } = useBranch();
  const supabase = useMemo(() => createClient(), []);

  const role = profile?.role;
  const isAdminOrDG = role === "ADMIN" || role === "DIRECTION_GENERALE";

  const [refDate, setRefDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [commercialFilter, setCommercialFilter] = useState("ALL");
  const [commercials, setCommercials] = useState<ProfileOption[]>([]);
  const [fiches, setFiches] = useState<RdvFiche[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [editingFiche, setEditingFiche] = useState<RdvFiche | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const grid = useMemo<Date[][]>(
    () => (viewMode === "month" ? getMonthGrid(refDate) : [getWeekDays(refDate)]),
    [refDate, viewMode],
  );

  const rangeStart = grid[0][0];
  const rangeEnd = grid[grid.length - 1][6];
  const rangeStartKey = toDateKey(rangeStart);
  const rangeEndKey = toDateKey(rangeEnd);

  // Liste des commerciaux pour le filtre (direction uniquement)
  const branchFilterForUsers = isDG && selectedBranchId !== "all" ? selectedBranchId : null;
  useEffect(() => {
    if (!isAdminOrDG) return;
    async function loadCommercials() {
      let q = supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("role", "COMMERCIAL")
        .eq("is_active", true)
        .order("last_name");
      if (branchFilterForUsers) q = q.eq("organization_id", branchFilterForUsers);
      const { data } = await q;
      setCommercials(data ?? []);
    }
    loadCommercials();
  }, [isAdminOrDG, branchFilterForUsers, supabase]);

  const fetchRdvs = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    let query = supabase
      .from("fiches")
      .select(
        "id, reference, status, rdv_date, heure_visite, prospect_nom, prospect_prenom, prospect_adresse, prospect_ville, prospect_telephone, organization_id, " +
        "assigned_to_profile:profiles!fiches_assigned_to_fkey(first_name, last_name)"
      )
      .not("rdv_date", "is", null)
      .gte("rdv_date", rangeStartKey)
      .lte("rdv_date", rangeEndKey)
      .order("rdv_date", { ascending: true })
      .order("heure_visite", { ascending: true, nullsFirst: false });

    if (role === "PROSPECTEUR" || role === "CHEF_EQUIPE") {
      query = query.eq("created_by", profile.id);
    } else if (role === "COMMERCIAL") {
      query = query.eq("assigned_to", profile.id);
    } else if (isAdminOrDG && commercialFilter !== "ALL") {
      query = query.eq("assigned_to", commercialFilter);
    }

    const branchFilter = isDG && selectedBranchId !== "all" ? selectedBranchId : null;
    if (branchFilter) query = query.eq("organization_id", branchFilter);

    try {
      const { data, error } = await query;
      if (error) throw error;
      setFiches((data as unknown as RdvFiche[]) ?? []);
      setFetchError(null);
    } catch (err) {
      console.error("fetchRdvs error", err);
      setFetchError("Erreur lors du chargement des rendez-vous.");
    } finally {
      setLoading(false);
    }
  }, [profile, role, isAdminOrDG, commercialFilter, isDG, selectedBranchId, rangeStartKey, rangeEndKey, supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRdvs();
  }, [fetchRdvs]);

  const filteredFiches = useMemo(() => {
    if (!searchQuery.trim()) return fiches;
    const q = searchQuery.toLowerCase().trim();
    return fiches.filter((f) => {
      const nom = `${f.prospect_nom ?? ""} ${f.prospect_prenom ?? ""}`.toLowerCase();
      const ville = (f.prospect_ville ?? "").toLowerCase();
      const commercial = f.assigned_to_profile ? `${f.assigned_to_profile.first_name} ${f.assigned_to_profile.last_name}`.toLowerCase() : "";
      return nom.includes(q) || ville.includes(q) || commercial.includes(q) || (f.reference ?? "").toLowerCase().includes(q);
    });
  }, [fiches, searchQuery]);

  const fichesByDay = useMemo(() => {
    const map = new Map<string, RdvFiche[]>();
    for (const f of filteredFiches) {
      const key = f.rdv_date;
      const list = map.get(key) ?? [];
      list.push(f);
      map.set(key, list);
    }
    return map;
  }, [filteredFiches]);

  const goPrev = () => setRefDate((d) => (viewMode === "month" ? addMonths(d, -1) : addWeeks(d, -1)));
  const goNext = () => setRefDate((d) => (viewMode === "month" ? addMonths(d, 1) : addWeeks(d, 1)));
  const goToday = () => setRefDate(new Date());

  const periodLabel =
    viewMode === "month"
      ? formatMonthLabel(refDate)
      : `${grid[0][0].getDate()} ${MOIS_NOMS[grid[0][0].getMonth()]} – ${grid[0][6].getDate()} ${MOIS_NOMS[grid[0][6].getMonth()]} ${grid[0][6].getFullYear()}`;

  const totalCount = filteredFiches.length;
  const selectedFiches = selectedDayKey ? fichesByDay.get(selectedDayKey) ?? [] : [];

  return (
    <>
      <Topbar title="Calendrier des RDV" />
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={goPrev} aria-label="Période précédente">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={goToday}>Aujourd&apos;hui</Button>
            <Button variant="outline" size="icon" onClick={goNext} aria-label="Période suivante">
              <ChevronRight className="w-4 h-4" />
            </Button>
            <span className="ml-2 font-heading text-base sm:text-lg font-semibold capitalize">
              {periodLabel}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Rechercher un RDV…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 h-[34px] text-sm rounded-xl border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Effacer la recherche"
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            {isAdminOrDG && (
              <Select value={commercialFilter} onValueChange={(v) => setCommercialFilter(v ?? "ALL")}>
                <SelectTrigger className="h-[34px] bg-background rounded-xl text-sm w-[180px]">
                  <SelectValue>
                    {commercialFilter === "ALL"
                      ? "Tous les commerciaux"
                      : (() => {
                          const c = commercials.find((x) => x.id === commercialFilter);
                          return c ? `${c.first_name} ${c.last_name}` : "Tous les commerciaux";
                        })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Tous les commerciaux</SelectItem>
                  {commercials.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.first_name} {c.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="flex items-center rounded-xl border bg-background p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("month")}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${viewMode === "month" ? "bg-muted font-medium" : "text-muted-foreground"}`}
              >
                Mois
              </button>
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${viewMode === "week" ? "bg-muted font-medium" : "text-muted-foreground"}`}
              >
                Semaine
              </button>
            </div>
          </div>
        </div>

        {fetchError && (
          <div className="rounded-xl bg-red-50 text-red-700 ring-1 ring-red-200/60 px-4 py-2 text-sm">{fetchError}</div>
        )}

        <div className="rounded-2xl border bg-background overflow-hidden">
          <div className="grid grid-cols-7 border-b bg-muted/40">
            {JOURS_ENTETE.map((j) => (
              <div key={j} className="px-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-center">
                {j}
              </div>
            ))}
          </div>

          {grid.map((week, wi) => (
            <div key={wi} className={`grid grid-cols-7 ${wi < grid.length - 1 ? "border-b" : ""}`}>
              {week.map((day) => {
                const key = toDateKey(day);
                const dayFiches = (fichesByDay.get(key) ?? []).slice().sort((a, b) => (a.heure_visite ?? "99:99").localeCompare(b.heure_visite ?? "99:99"));
                const inCurrentMonth = viewMode === "week" || day.getMonth() === refDate.getMonth();
                const isToday = isSameDay(day, new Date());
                const maxShown = viewMode === "week" ? 20 : 3;
                const shown = dayFiches.slice(0, maxShown);
                const hidden = dayFiches.length - shown.length;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => dayFiches.length > 0 && setSelectedDayKey(key)}
                    className={`min-h-[92px] sm:min-h-[110px] border-r last:border-r-0 p-1.5 sm:p-2 text-left align-top flex flex-col gap-1 transition-colors ${
                      inCurrentMonth ? "bg-background" : "bg-muted/20"
                    } ${dayFiches.length > 0 ? "hover:bg-muted/40 cursor-pointer" : "cursor-default"}`}
                  >
                    <span
                      className={`text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full ${
                        isToday ? "bg-[#F97316] text-white" : inCurrentMonth ? "text-foreground" : "text-muted-foreground/50"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    <div className="flex flex-col gap-0.5 flex-1">
                      {shown.map((f) => (
                        <span
                          key={f.id}
                          title="Plus de détails"
                          className={`truncate rounded px-1.5 py-0.5 text-[10px] sm:text-[11px] leading-tight ${
                            f.status === "RDV_A_REPRENDRE"
                              ? "bg-[#F97316] text-white font-semibold"
                              : "bg-blue-50 text-blue-700 ring-1 ring-blue-200/60"
                          }`}
                        >
                          {f.heure_visite ? f.heure_visite.slice(0, 5) + " " : ""}
                          <span className="font-bold">{f.prospect_nom ?? "Sans nom"}</span>
                        </span>
                      ))}
                      {hidden > 0 && (
                        <span className="text-[10px] text-muted-foreground font-medium">+{hidden} autre{hidden > 1 ? "s" : ""}</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {!loading && totalCount === 0 && (
          <div className="text-center text-sm text-muted-foreground py-8">
            Aucun rendez-vous planifié sur cette période.
          </div>
        )}
      </div>

      <Dialog open={!!selectedDayKey} onOpenChange={(open) => !open && setSelectedDayKey(null)}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedDayKey &&
                new Date(`${selectedDayKey}T00:00:00`).toLocaleDateString("fr-FR", {
                  weekday: "long", day: "numeric", month: "long", year: "numeric",
                })}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {selectedFiches.map((f) => (
              <div
                key={f.id}
                className="rounded-xl border p-3 hover:bg-muted/40 transition-colors flex flex-col gap-1.5"
              >
                <Link
                  href={`/fiches/${f.id}`}
                  className="flex items-center justify-between gap-2"
                  title="Cliquer ici pour accéder à la Fiche Client"
                >
                  <span className="font-medium text-sm">
                    {f.prospect_prenom} {f.prospect_nom}
                  </span>
                  <FicheStatusBadge status={f.status} short />
                </Link>
                <Link href={`/fiches/${f.id}`} className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {f.heure_visite && (
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 shrink-0" />{f.heure_visite.slice(0, 5)}</span>
                  )}
                  {(f.prospect_adresse || f.prospect_ville) && (
                    <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 shrink-0" />{[f.prospect_adresse, f.prospect_ville].filter(Boolean).join(", ")}</span>
                  )}
                  {f.prospect_telephone && (
                    <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 shrink-0" />{f.prospect_telephone}</span>
                  )}
                  {isAdminOrDG && fullName(f.assigned_to_profile) && (
                    <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 shrink-0" />{fullName(f.assigned_to_profile)}</span>
                  )}
                </Link>
                {f.status === "RDV_A_REPRENDRE" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg self-start gap-1.5 mt-1"
                    onClick={() => setEditingFiche(f)}
                  >
                    <CalendarClock className="w-3.5 h-3.5" />
                    Modifier la date
                  </Button>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {editingFiche && profile && (
        <RdvEditDialog
          open={!!editingFiche}
          onOpenChange={(open) => !open && setEditingFiche(null)}
          ficheId={editingFiche.id}
          currentRdvDate={editingFiche.rdv_date}
          organizationId={editingFiche.organization_id}
          userId={profile.id}
          onSaved={(newDate) => {
            setFiches((prev) =>
              prev.map((f) => (f.id === editingFiche.id ? { ...f, rdv_date: newDate } : f)),
            );
            setEditingFiche(null);
          }}
        />
      )}
    </>
  );
}
