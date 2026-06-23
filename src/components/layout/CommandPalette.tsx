"use client";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Search, FileText, X, ArrowRight, Loader2 } from "lucide-react";
import { FicheStatusBadge } from "@/components/fiches/FicheStatusBadge";
import type { FicheStatus } from "@/types/database";

interface Result {
  id: string;
  reference: string;
  prospect_nom: string | null;
  prospect_prenom: string | null;
  prospect_ville: string | null;
  prospect_cp: string | null;
  status: FicheStatus;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
      setActiveIdx(0);
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("fiches")
      .select("id, reference, prospect_nom, prospect_prenom, prospect_ville, prospect_cp, status")
      .or(
        `reference.ilike.%${q}%,prospect_nom.ilike.%${q}%,prospect_prenom.ilike.%${q}%,prospect_ville.ilike.%${q}%,prospect_cp.ilike.%${q}%`
      )
      .order("updated_at", { ascending: false })
      .limit(8);
    setResults((data as Result[]) ?? []);
    setActiveIdx(0);
    setLoading(false);
  }, [supabase]);

  // Cleanup debounce on unmount
  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 250);
  }

  function navigate(result: Result) {
    onClose();
    router.push(`/fiches/${result.id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && results[activeIdx]) navigate(results[activeIdx]);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-xl mx-4 bg-card rounded-2xl shadow-2xl border border-border overflow-hidden"
        style={{ animation: "fadeSlideIn 0.18s ease both" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input row */}
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
            placeholder="Rechercher une fiche, un prospect, une ville…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <ul className="py-2 max-h-80 overflow-y-auto">
            {results.map((r, idx) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => navigate(r)}
                  onMouseEnter={() => setActiveIdx(idx)}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3 transition-colors ${
                    idx === activeIdx ? "bg-secondary" : "hover:bg-secondary/50"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    idx === activeIdx ? "bg-primary text-white" : "bg-muted text-muted-foreground"
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
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r.reference}{r.prospect_ville ? ` · ${r.prospect_cp} ${r.prospect_ville}` : ""}
                    </p>
                  </div>
                  {idx === activeIdx && <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                </button>
              </li>
            ))}
          </ul>
        ) : query.trim().length >= 2 && !loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Aucun résultat pour <span className="font-medium text-foreground">"{query}"</span>
          </div>
        ) : query.trim().length === 0 ? (
          <div className="py-6 px-4 space-y-4">
            <p className="text-center text-xs text-muted-foreground">Tapez au moins 2 caractères pour rechercher</p>
            {/* Raccourcis clavier */}
            <div className="border-t border-border pt-4 space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">Raccourcis clavier</p>
              {[
                { keys: ["⌘", "K"], label: "Ouvrir la recherche" },
                { keys: ["N"], label: "Nouvelle fiche" },
                { keys: ["↑", "↓"], label: "Naviguer dans les résultats" },
                { keys: ["↵"], label: "Ouvrir la fiche" },
                { keys: ["Esc"], label: "Fermer" },
              ].map(({ keys, label }) => (
                <div key={label} className="flex items-center justify-between px-1">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <div className="flex items-center gap-1">
                    {keys.map((k) => (
                      <kbd key={k} className="font-mono text-[10px] bg-secondary border border-border rounded px-1.5 py-0.5 text-foreground">{k}</kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
