"use client";

import { useBranch } from "@/lib/context/branch-context";
import { Building2, ChevronDown } from "lucide-react";

export function BranchSelector() {
  const { isDG, branches, selectedBranchId, setSelectedBranchId, loading } = useBranch();

  if (!isDG || loading) return null;

  return (
    <div className="px-3 pb-1">
      <div className="relative">
        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6e6e73] pointer-events-none" />
        <select
          value={selectedBranchId}
          onChange={(e) => setSelectedBranchId(e.target.value)}
          className="w-full appearance-none bg-white/60 backdrop-blur-md text-[#1d1d1f] text-sm font-medium pl-9 pr-8 py-2 rounded-xl border border-white/40 hover:bg-white/80 transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-[#F97316]/50"
          title="Filtrer par succursale"
        >
          <option value="all">Toutes les succursales</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}{b.is_hq ? " (Siège)" : ""}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6e6e73] pointer-events-none" />
      </div>
    </div>
  );
}
