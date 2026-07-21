"use client";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  Search, FileText, X, ArrowRight, Loader2,
  LayoutDashboard, Users, Bell, BarChart3, CalendarDays,
  FilePlus, UserCircle, Building2, Building, ArrowUpRight,
} from "lucide-react";
import { FicheStatusBadge } from "@/components/fiches/FicheStatusBadge";
import { useProfile } from "@/lib/hooks/use-profile";
import type { FicheStatus } from "@/types/database";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FicheResult {
  kind: "fiche";
  id: string;
  reference: string;
  prospect_nom: string | null;
  prospect_prenom: string | null;
  prospect_ville: string | null;
  prospect_cp: string | null;
  status: FicheStatus;
}

interface UserResult {
  kind: "user";
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  email?: string;
}

interface PageResult {
  kind: "page";
  label: string;
  href: string;
  icon: React.ElementType;
  description?: string;
}

type AnyResult = FicheResult | UserResult | PageResult;

// ── Navigation shortcuts ────────────────────────────────────────────────────

const ALL_PAGES: PageResult[] = [
  { kind: "page", label: "Tableau de bord",    href: "/",                 icon: LayoutDashboard, description: "Vue générale et KPI" },
  { kind: "page", label: "Statut des Fiches",  href: "/fiches",           icon: FileText,        description: "Liste de toutes les fiches" },
  { kind: "page", label: "Nouvelle fiche",     href: "/fiches/nouvelle",  icon: FilePlus,        description: "Créer une fiche prospect" },
  { kind: "page", label: "Planification",      href: "/planification",    icon: CalendarDays,    description: "Planning hebdomadaire" },
  { kind: "page", label: "Notifications",      href: "/notifications",    icon: Bell,            description: "Centre de notifications" },
  { kind: "page", label: "Mon profil",         href: "/profil",           icon: UserCircle,      description: "Paramètres du compte" },
  { kind: "page", label: "Utilisateurs",       href: "/utilisateurs",     icon: Users,           description: "Gestion des équipes" },
  { kind: "page", label: "Reporting",          href: "/reporting",        icon: BarChart3,       description: "Statistiques et analyses" },
  { kind: "page", label: "Société",            href: "/admin/societe",    icon: Building,        description: "Paramètres société" },
  { kind: "page", label: "Succursales",        href: "/admin/succursales",icon: Building2,       description: "Gestion des agences" },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  COMMERCIAL: "Commercial",
  PROSPECTEUR: "Référent",
  CHEF_EQUIPE: "Chef d'équipe",
  DIRECTION_GENERALE: "Direction générale",
};

// ── Raccourcis affiché quand query vide ─────────────────────────────────────

const SHORTCUTS = [
  { keys: ["⌘", "K"], label: "Ouvrir la recherche" },
  { keys: ["N"],       label: "Nouvelle fiche" },
  { keys: ["↑", "↓"], label: "Naviguer" },
  { keys: ["↵"],       label: "Ouvrir" },
  { keys: ["Esc"],     label: "Fermer" },
];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [fiches, setFiches] = useState<FicheResult[]>([]);
  const [users, setUsers] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { profile } = useProfile();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isAdminOrDG = profile?.role === "ADMIN" || profile?.role === "DIRECTION_GENERALE";

  // Pages filtrées selon le rôle
  const availablePages = useMemo(() => {
    if (!profile) return [];
    const role = profile.role;
    return ALL_PAGES.filter((p) => {
      if (p.href === "/utilisateurs" || p.href === "/reporting") return role === "ADMIN" || role === "DIRECTION_GENERALE" || role === "COMMERCIAL";
      if (p.href === "/admin/societe" || p.href === "/admin/succursales") return role === "DIRECTION_GENERALE";
      return true;
    });
  }, [profile]);

  // Pages filtrées par query
  const filteredPages = useMemo(() => {
    if (query.trim().length < 2) return availablePages.slice(0, 6);
    const q = query.toLowerCase();
    return availablePages.filter((p) =>
      p.label.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q)
    );
  }, [query, availablePages]);

  // Résultats aplatis pour navigation clavier
  const allResults: AnyResult[] = useMemo(() => {
    if (query.trim().length < 2) return filteredPages;
    return [...filteredPages, ...fiches, ...users];
  }, [query, filteredPages, fiches, users]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setFiches([]);
      setUsers([]);
      setActiveIdx(0);
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setFiches([]); setUsers([]); setLoading(false); return; }
    setLoading(true);

    const fichesQ = supabase
      .from("fiches")
      .select("id, reference, prospect_nom, prospect_prenom, prospect_ville, prospect_cp, status")
      .or(`reference.ilike.%${q}%,prospect_nom.ilike.%${q}%,prospect_prenom.ilike.%${q}%,prospect_ville.ilike.%${q}%,prospect_cp.ilike.%${q}%`)
      .order("updated_at", { ascending: false })
      .limit(6);

    const usersQ = isAdminOrDG
      ? supabase.from("profiles").select("id, first_name, last_name, role").or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%`).limit(4)
      : Promise.resolve({ data: [] });

    const [fichesRes, usersRes] = await Promise.all([fichesQ, usersQ]);

    setFiches((fichesRes.data ?? []).map((f) => ({ kind: "fiche" as const, ...f })));
    setUsers((usersRes.data ?? []).map((u) => ({ kind: "user" as const, ...u })));
    setActiveIdx(0);
    setLoading(false);
  }, [supabase, isAdminOrDG]);

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 250);
  }

  function navigate(result: AnyResult) {
    onClose();
    if (result.kind === "fiche") router.push(`/fiches/${result.id}`);
    else if (result.kind === "user") router.push(`/utilisateurs`);
    else router.push(result.href);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, allResults.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && allResults[activeIdx]) navigate(allResults[activeIdx]);
  }

  if (!open) return null;

  const hasQuery = query.trim().length >= 2;
  const hasResults = hasQuery && (fiches.length > 0 || users.length > 0 || filteredPages.length > 0);
  const noResults = hasQuery && !loading && fiches.length === 0 && users.length === 0 && filteredPages.length === 0;

  // Offset pour les indices clavier : pages d'abord, puis fiches, puis users
  const pageOffset = 0;
  const ficheOffset = filteredPages.length;
  const userOffset = ficheOffset + fiches.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      <div
        className="relative w-full max-w-xl mx-4 bg-card rounded-2xl shadow-2xl border border-border overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          {loading
            ? <Loader2 className="w-5 h-5 text-muted-foreground shrink-0 animate-spin" />
            : <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          }
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher une fiche, un utilisateur, une page…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(""); setFiches([]); setUsers([]); inputRef.current?.focus(); }}
              className="shrink-0 p-1 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
              aria-label="Effacer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Résultats */}
        <div ref={listRef} className="max-h-[60vh] overflow-y-auto">

          {/* Aucun résultat */}
          {noResults && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Aucun résultat pour <span className="font-medium text-foreground">&quot;{query}&quot;</span>
            </div>
          )}

          {/* Pages / Navigation */}
          {filteredPages.length > 0 && (
            <div className="py-2">
              <p className="px-4 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                {hasQuery ? "Pages" : "Navigation rapide"}
              </p>
              {filteredPages.map((page, i) => {
                const idx = pageOffset + i;
                const Icon = page.icon;
                return (
                  <button
                    key={page.href}
                    type="button"
                    onClick={() => navigate(page)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={`w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors ${
                      idx === activeIdx ? "bg-secondary" : "hover:bg-secondary/50"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      idx === activeIdx ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{page.label}</p>
                      {page.description && <p className="text-xs text-muted-foreground">{page.description}</p>}
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}

          {/* Fiches */}
          {fiches.length > 0 && (
            <div className="py-2 border-t border-border/60">
              <p className="px-4 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Fiches ({fiches.length})
              </p>
              {fiches.map((r, i) => {
                const idx = ficheOffset + i;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => navigate(r)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={`w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors ${
                      idx === activeIdx ? "bg-secondary" : "hover:bg-secondary/50"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      idx === activeIdx ? "bg-[#F97316]/10 text-[#F97316]" : "bg-muted text-muted-foreground"
                    }`}>
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {[r.prospect_prenom, r.prospect_nom].filter(Boolean).join(" ") || "—"}
                        </span>
                        <FicheStatusBadge status={r.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {r.reference}{r.prospect_ville ? ` · ${r.prospect_cp} ${r.prospect_ville}` : ""}
                      </p>
                    </div>
                    {idx === activeIdx && <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Utilisateurs */}
          {users.length > 0 && (
            <div className="py-2 border-t border-border/60">
              <p className="px-4 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Utilisateurs ({users.length})
              </p>
              {users.map((u, i) => {
                const idx = userOffset + i;
                const initials = `${u.first_name[0]}${u.last_name[0]}`.toUpperCase();
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => navigate(u)}
                    onMouseEnter={() => setActiveIdx(idx)}
                    className={`w-full text-left flex items-center gap-3 px-4 py-2.5 transition-colors ${
                      idx === activeIdx ? "bg-secondary" : "hover:bg-secondary/50"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                      idx === activeIdx ? "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400" : "bg-muted text-muted-foreground"
                    }`}>
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{u.first_name} {u.last_name}</p>
                      <p className="text-xs text-muted-foreground">{ROLE_LABELS[u.role] ?? u.role}</p>
                    </div>
                    {idx === activeIdx && <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* Raccourcis clavier — état vide */}
          {!hasQuery && (
            <div className="border-t border-border py-3 px-4">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Raccourcis clavier</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {SHORTCUTS.map(({ keys, label }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <div className="flex items-center gap-0.5">
                      {keys.map((k) => (
                        <kbd key={k} className="font-mono text-[10px] bg-secondary border border-border rounded px-1.5 py-0.5 text-foreground">{k}</kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
