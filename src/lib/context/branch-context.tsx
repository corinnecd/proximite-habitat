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
}

const BranchContext = createContext<BranchContextValue>({
  selectedBranchId: "all",
  setSelectedBranchId: () => {},
  branches: [],
  loading: true,
  isDG: false,
});

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  const [branches, setBranches] = useState<Organization[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string | "all">("all");
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

  const value = useMemo(
    () => ({ selectedBranchId, setSelectedBranchId, branches, loading, isDG }),
    [selectedBranchId, branches, loading, isDG],
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
