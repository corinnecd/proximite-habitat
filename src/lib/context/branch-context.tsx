"use client";

import { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import type { Organization } from "@/types/database";

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
  const { profile } = useProfile();
  const [branches, setBranches] = useState<Organization[]>([]);
  const [selectedBranchId, setSelectedBranchIdRaw] = useState<string | "all">(() => {
    if (typeof window === "undefined") return "all";
    return (localStorage.getItem("selectedBranchId") as string) || "all";
  });
  const setSelectedBranchId = useCallback((id: string | "all") => {
    setSelectedBranchIdRaw(id);
    if (typeof window !== "undefined") localStorage.setItem("selectedBranchId", id);
  }, []);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  const isDG = profile?.role === "DIRECTION_GENERALE";

  const fetchBranches = useCallback(async () => {
    if (!isDG) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("organizations")
      .select("*")
      .order("name");
    setBranches(data ?? []);
    setLoading(false);
  }, [supabase, isDG]);

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
