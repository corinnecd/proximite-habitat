"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import type { Organization } from "@/types/database";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Cache localStorage des succursales — même logique que profile-context.tsx :
// évite le flash "0 succursale" le temps que profil + rôle DG soient résolus.
const BRANCHES_CACHE_KEY = "ph_branches_v1";

function readBranchesCache(): Organization[] | null {
  try {
    const v = localStorage.getItem(BRANCHES_CACHE_KEY);
    return v ? (JSON.parse(v) as Organization[]) : null;
  } catch {
    return null;
  }
}
function writeBranchesCache(value: Organization[]) {
  try { localStorage.setItem(BRANCHES_CACHE_KEY, JSON.stringify(value)); } catch {}
}

interface BranchContextValue {
  selectedBranchId: string | "all";
  setSelectedBranchId: (id: string | "all") => void;
  branches: Organization[];
  loading: boolean;
  isDG: boolean;
  selectedBranchName: string | null;
}

const BranchContext = createContext<BranchContextValue>({
  selectedBranchId: "all",
  setSelectedBranchId: () => {},
  branches: [],
  loading: true,
  isDG: false,
  selectedBranchName: null,
});

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { profile, loading: profileLoading } = useProfile();
  // SSR-safe : démarre toujours avec des valeurs neutres pour éviter les erreurs d'hydratation.
  // Le cache est restauré dans useIsomorphicLayoutEffect (avant le paint).
  const [branches, setBranches] = useState<Organization[]>([]);
  const [selectedBranchId, setSelectedBranchIdRaw] = useState<string | "all">("all");

  useIsomorphicLayoutEffect(() => {
    const cached = readBranchesCache();
    if (cached?.length) setBranches(cached);
    try {
      const saved = localStorage.getItem("selectedBranchId");
      if (saved) setSelectedBranchIdRaw(saved);
    } catch {}
  }, []);
  const setSelectedBranchId = useCallback((id: string | "all") => {
    setSelectedBranchIdRaw(id);
    if (typeof window !== "undefined") localStorage.setItem("selectedBranchId", id);
  }, []);
  // Tant que le profil n'est pas résolu, on ne sait pas encore si l'utilisateur est DG :
  // on reste en attente plutôt que d'affirmer isDG=false par défaut (source du flash observé).
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  const isDG = profile?.role === "DIRECTION_GENERALE";

  const fetchBranches = useCallback(async () => {
    if (profileLoading) return; // attend la résolution du profil (cache ou réseau)
    if (!isDG) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("organizations")
      .select("*")
      .order("name");
    const rows = data ?? [];
    setBranches(rows);
    writeBranchesCache(rows);
    setLoading(false);
  }, [supabase, isDG, profileLoading]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const selectedBranchName = selectedBranchId !== "all"
    ? branches.find((b) => b.id === selectedBranchId)?.name ?? null
    : null;

  const value = useMemo(
    () => ({ selectedBranchId, setSelectedBranchId, branches, loading, isDG, selectedBranchName }),
    [selectedBranchId, branches, loading, isDG, selectedBranchName],
  );

  return (
    <BranchContext.Provider value={value}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  return useContext(BranchContext);
}
