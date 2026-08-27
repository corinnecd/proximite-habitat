"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
type CalType = "commercial" | "technicien" | "all";

type RdvKind = "commercial" | "technicien";
interface RdvEvent { fiche: RdvFiche; kind: RdvKind; date: string; heure: string | null; }

interface ProfileOption { id: string; first_name: string; last_name: string; }

interface RdvFiche {
  id: string;
  reference: string;
  status: FicheStatus;
  rdv_date: string | null;
  rdv_technicien_date: string | null;
  rdv_technicien_heure: string | null;
  heure_visite: string | null;
  prospect_nom: string | null;
  prospect_prenom: string | null;
  prospect_adresse: string | null;
  prospect_ville: string | null;
  prospect_telephone: string | null;
  organization_id: string;
  created_by: string | null;
  assigned_to_profile: { first_name: string; last_name: string } | null;
}

const STATUS_CHIP: Record<string, { bg: string; text: string }> = {
  VALIDEE: { bg: "bg-emerald-50 dark:bg-emerald-950/30", text: "text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200/60" },
  AFFECTEE: { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 ring-1 ring-blue-200/60" },
  RDV_A_REPRENDRE: { bg: "bg-[#F97316]", text: "text-white font-semibold" },
  RDV_TECHNICIEN: { bg: "bg-sky-50 dark:bg-sky-950/30", text: "text-sky-700 dark:text-sky-300 ring-1 ring-sky-200/60" },
  INSTALLEE: { bg: "bg-violet-50 dark:bg-violet-950/30", text: "text-violet-700 dark:text-violet-300 ring-1 ring-violet-200/60" },
};

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
  const isAdminOrDG = role === "DIRECTION" || role === "DIRECTION_GENERALE" || role === "SUPER_ADMIN";

  const [refDate, setRefDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [calType, setCalType] = useState<CalType>("commercial");
  const [commercialFilter, setCommercialFilter] = useState("ALL");
  const [commercials, setCommercials] = useState<ProfileOption[]>([]);
  const [fiches, setFiches] = useState<RdvFiche[]>([]);
  const [loading, setLoading] = useState(true);
  const hasLoadedOnceRef = useRef(false);
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

  const branchFilterForUsers = isDG && selectedBranchId !== "all" ? selectedBranchId : null;
  const isReferent = role === "PROSPECTEUR" || role === "CHEF_EQUIPE";

  const fetchRdvs = useCallback(async () => {
    if (!profile) return;
    // Stale-while-revalidate : au premier chargement seulement. Sur une navigation
    // mois/semaine, la grille reste affichée et les RDV se remplacent silencieusement,
    // sans repasser par l'état vide « Aucun rendez-vous » entre deux périodes.
    if (!hasLoadedOnceRef.current) setLoading(true);
    const COMMERCIAL_STATUSES: FicheStatus[] = ["VALIDEE", "AFFECTEE", "RDV_A_REPRENDRE", "ACCEPTEE", "REFUSEE"];
    const TECHNICIEN_STATUSES: FicheStatus[] = ["RDV_TECHNICIEN", "INSTALLEE"];
    const statuses: FicheStatus[] = calType === "technicien"
      ? TECHNICIEN_STATUSES
      : calType === "all"
        ? [...new Set([...COMMERCIAL_STATUSES, ...TECHNICIEN_STATUSES])]
        : COMMERCIAL_STATUSES;

    let query = supabase
      .from("fiches")
      .select(
        "id, reference, status, rdv_date, rdv_technicien_date, rdv_technicien_heure, heure_visite, prospect_nom, prospect_prenom, prospect_adresse, prospect_ville, prospect_telephone, organization_id, created_by, " +
        "assigned_to_profile:profiles!fiches_assigned_to_fkey(first_name, last_name)"
      )
      .in("status", statuses);

    if (calType === "all") {
      // fiche a un RDV commercial OU technicien dans la plage
      query = query.or(
        `and(rdv_date.gte.${rangeStartKey},rdv_date.lte.${rangeEndKey}),and(rdv_technicien_date.gte.${rangeStartKey},rdv_technicien_date.lte.${rangeEndKey})`
      );
    } else {
      const dateField = calType === "technicien" ? "rdv_technicien_date" : "rdv_date";
      const heureField = calType === "technicien" ? "rdv_technicien_heure" : "heure_visite";
      query = query
        .not(dateField, "is", null)
        .gte(dateField, rangeStartKey)
        .lte(dateField, rangeEndKey)
        .order(dateField, { ascending: true })
        .order(heureField, { ascending: true, nullsFirst: false });
    }

    if (isReferent) {
      query = query.eq("created_by", profile.id);
    } else if (role === "COMMERCIAL") {
      query = query.eq("assigned_to", profile.id);
    } else if (isAdminOrDG && commercialFilter !== "ALL") {
      query = query.eq("assigned_to", commercialFilter);
    }

    const branchFilter = isDG
      ? (selectedBranchId !== "all" ? selectedBranchId : null)
      : profile.organization_id;
    if (branchFilter) query = query.eq("organization_id", branchFilter);

    // Commerciaux pour le filtre admin — chargés en parallèle avec les RDV
    let commercialsQuery = null;
    if (isAdminOrDG) {
      let cq = supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("role", "COMMERCIAL")
        .eq("is_active", true)
        .order("last_name");
      if (branchFilterForUsers) cq = cq.eq("organization_id", branchFilterForUsers);
      commercialsQuery = cq;
    }

    try {
      const [fichesResult, commercialsResult] = await Promise.all([
        query,
        commercialsQuery,
      ]);
      if (fichesResult.error) throw fichesResult.error;
      setFiches((fichesResult.data as unknown as RdvFiche[]) ?? []);
      if (commercialsResult?.data) setCommercials(commercialsResult.data);
      setFetchError(null);
    } catch (err) {
      console.error("fetchRdvs error", err);
      setFetchError("Erreur lors du chargement des rendez-vous.");
    } finally {
      hasLoadedOnceRef.current = true;
      setLoading(false);
    }
  }, [profile, role, isAdminOrDG, isReferent, commercialFilter, isDG, selectedBranchId, branchFilterForUsers, rangeStartKey, rangeEndKey, supabase, calType]);

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

  const eventsByDay = useMemo(() => {
    const map = new Map<string, RdvEvent[]>();
    const pushEvent = (fiche: RdvFiche, kind: RdvKind, date: string | null, heure: string | null) => {
      if (!date) return;
      if (date < rangeStartKey || date > rangeEndKey) return;
      const list = map.get(date) ?? [];
      list.push({ fiche, kind, date, heure });
      map.set(date, list);
    };
    for (const f of filteredFiches) {
      if (calType === "commercial") {
        pushEvent(f, "commercial", f.rdv_date, f.heure_visite);
      } else if (calType === "technicien") {
        pushEvent(f, "technicien", f.rdv_technicien_date, f.rdv_technicien_heure);
      } else {
        pushEvent(f, "commercial", f.rdv_date, f.heure_visite);
        pushEvent(f, "technicien", f.rdv_technicien_date, f.rdv_technicien_heure);
      }
    }
    // En mode « Tous », la requête n'a pas de `.order()` (filtre `or` sur deux
    // colonnes de date) : on trie ici pour un ordre déterministe dans la journée.
    for (const list of map.values()) {
      list.sort((a, b) =>
        (a.heure ?? "99:99").localeCompare(b.heure ?? "99:99") ||
        `${a.fiche.prospect_nom ?? ""}`.localeCompare(`${b.fiche.prospect_nom ?? ""}`),
      );
    }
    return map;
  }, [filteredFiches, calType, rangeStartKey, rangeEndKey]);

  const goPrev = () => setRefDate((d) => (viewMode === "month" ? addMonths(d, -1) : addWeeks(d, -1)));
  const goNext = () => setRefDate((d) => (viewMode === "month" ? addMonths(d, 1) : addWeeks(d, 1)));
  const goToday = () => setRefDate(new Date());

  const periodLabel =
    viewMode === "month"
      ? formatMonthLabel(refDate)
      : `${grid[0][0].getDate()} ${MOIS_NOMS[grid[0][0].getMonth()]} – ${grid[0][6].getDate()} ${MOIS_NOMS[grid[0][6].getMonth()]} ${grid[0][6].getFullYear()}`;

  const totalCount = useMemo(() => {
    let n = 0;
    for (const list of eventsByDay.values()) n += list.length;
    return n;
  }, [eventsByDay]);
  const selectedEvents = selectedDayKey ? eventsByDay.get(selectedDayKey) ?? [] : [];

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
            <div className="relative w-full sm:w-64">
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
                <SelectTrigger className="h-[34px] bg-background rounded-xl text-sm w-full sm:w-[220px]">
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
                onClick={() => setCalType("commercial")}
                className={`px-4 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap ${calType === "commercial" ? "bg-[#F97316] text-white font-medium" : "text-muted-foreground"}`}
              >
                Commercial
              </button>
              <button
                type="button"
                onClick={() => setCalType("technicien")}
                className={`px-4 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap ${calType === "technicien" ? "bg-sky-500 text-white font-medium" : "text-muted-foreground"}`}
              >
                Technicien
              </button>
              <button
                type="button"
                onClick={() => setCalType("all")}
                className={`px-4 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap ${calType === "all" ? "bg-violet-600 text-white font-medium" : "text-muted-foreground"}`}
              >
                Tous
              </button>
            </div>
            <div className="flex items-center rounded-xl border bg-background p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("month")}
                className={`px-4 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap ${viewMode === "month" ? "bg-[#F97316] text-white font-medium" : "text-muted-foreground"}`}
              >
                Mois
              </button>
              <button
                type="button"
                onClick={() => setViewMode("week")}
                className={`px-4 py-1.5 text-sm rounded-lg transition-colors whitespace-nowrap ${viewMode === "week" ? "bg-[#F97316] text-white font-medium" : "text-muted-foreground"}`}
              >
                Semaine
              </button>
            </div>
          </div>
        </div>

        {fetchError && (
          <div className="rounded-xl bg-red-50 text-red-700 ring-1 ring-red-200/60 px-4 py-2 text-sm">{fetchError}</div>
        )}

        <div className="rounded-2xl border bg-background overflow-x-auto">
          <div className="min-w-[420px]">
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
                const dayEvents = eventsByDay.get(key) ?? []; // déjà trié par heure dans eventsByDay
                const inCurrentMonth = viewMode === "week" || day.getMonth() === refDate.getMonth();
                const isToday = isSameDay(day, new Date());
                const maxShown = viewMode === "week" ? 20 : 3;
                const shown = dayEvents.slice(0, maxShown);
                const hidden = dayEvents.length - shown.length;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => dayEvents.length > 0 && setSelectedDayKey(key)}
                    className={`min-h-[92px] sm:min-h-[110px] border-r last:border-r-0 p-1.5 sm:p-2 text-left align-top flex flex-col gap-1 transition-colors ${
                      inCurrentMonth ? "bg-background" : "bg-muted/20"
                    } ${dayEvents.length > 0 ? "hover:bg-muted/40 cursor-pointer" : "cursor-default"}`}
                  >
                    <span
                      className={`text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full ${
                        isToday ? "bg-[#F97316] text-white" : inCurrentMonth ? "text-foreground" : "text-muted-foreground/50"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                    <div className="flex flex-col gap-0.5 flex-1">
                      {shown.map((ev, i) => {
                        const chip = ev.kind === "technicien"
                          ? { bg: "bg-sky-50 dark:bg-sky-950/30", text: "text-sky-700 dark:text-sky-300 ring-1 ring-sky-200/60" }
                          : (STATUS_CHIP[ev.fiche.status] ?? { bg: "bg-blue-50 dark:bg-blue-950/30", text: "text-blue-700 ring-1 ring-blue-200/60" });
                        return (
                          <span
                            key={`${ev.fiche.id}-${ev.kind}-${i}`}
                            title="Plus de détails"
                            className={`truncate rounded px-1.5 py-0.5 text-[10px] sm:text-[11px] leading-tight ${chip.bg} ${chip.text}`}
                          >
                            {(ev.heure?.slice(0, 5) ?? "") + " "}
                            <span className="font-bold">{ev.fiche.prospect_nom ?? "Sans nom"}</span>
                          </span>
                        );
                      })}
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
            {selectedEvents.map((ev, idx) => {
              const f = ev.fiche;
              return (
              <div
                key={`${f.id}-${ev.kind}-${idx}`}
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
                  <span className="flex items-center gap-1.5">
                    {ev.kind === "technicien" && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 ring-1 ring-sky-200/60">RDV Technicien</span>
                    )}
                    <FicheStatusBadge status={f.status} short />
                  </span>
                </Link>
                <Link href={`/fiches/${f.id}`} className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {ev.heure && (
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 shrink-0" />{ev.heure.slice(0, 5)}</span>
                  )}
                  {(f.prospect_adresse || f.prospect_ville) && (
                    <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 shrink-0" />{[f.prospect_adresse, f.prospect_ville].filter(Boolean).join(", ")}</span>
                  )}
                  {f.prospect_telephone && (
                    <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 shrink-0" />{f.prospect_telephone}</span>
                  )}
                  {(isAdminOrDG || isReferent) && fullName(f.assigned_to_profile) && (
                    <span className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 shrink-0" />{fullName(f.assigned_to_profile)}</span>
                  )}
                </Link>
                {ev.kind === "commercial" && (f.status === "RDV_A_REPRENDRE" || (isReferent && f.created_by === profile?.id)) && (
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
              );
            })}
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
