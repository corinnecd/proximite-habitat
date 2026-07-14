"use client";

import { useEffect, useState, useMemo } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import type { Company } from "@/types/database";
import { Loader2, Shield, Building, Building2, Users } from "lucide-react";

export default function SocietePage() {
  const { profile, loading: profileLoading } = useProfile();
  const supabase = useMemo(() => createClient(), []);

  const [company, setCompany] = useState<Company | null>(null);
  const [branchCount, setBranchCount] = useState(0);
  const [userCount, setUserCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profileLoading) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (profile?.role !== "DIRECTION_GENERALE") { setLoading(false); return; }
    (async () => {
      const { data: companies } = await supabase.from("companies").select("*").limit(1);
      setCompany(companies?.[0] ?? null);
      const { count: orgCount } = await supabase
        .from("organizations")
        .select("id", { count: "exact", head: true });
      setBranchCount(orgCount ?? 0);
      const { count: profCount } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true });
      setUserCount(profCount ?? 0);
      setLoading(false);
    })();
  }, [profile, profileLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!profileLoading && profile?.role !== "DIRECTION_GENERALE") {
    return (
      <>
        <Topbar title="Société" />
        <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <Shield className="w-8 h-8 text-muted-foreground opacity-40" />
            </div>
            <p className="text-muted-foreground">Accès réservé à la Direction Générale.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Topbar title="Société" />
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !company ? (
          <p className="text-muted-foreground">Aucune société rattachée.</p>
        ) : (
          <>
            {/* ═══ HERO SOCIÉTÉ — navy signature ═══════════════════════ */}
            <div className="hero-surface hero-surface-sm animate-hero-entry rounded-3xl p-6 sm:p-8">
              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-5">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#F97316] flex items-center justify-center shrink-0">
                  <Building className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] tracking-[1.2px] uppercase text-white/50 font-medium">
                    Société mère
                  </span>
                  <h1 className="font-heading text-3xl sm:text-4xl text-white leading-none tracking-tight mt-1.5">
                    {company.name}
                  </h1>
                  <p className="text-sm text-white/60 mt-2 font-mono">{company.slug}</p>
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="bg-card border border-border border-l-4 border-l-rose-500 rounded-2xl p-5 hover:-translate-y-0.5 hover:shadow-md transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div>
                    <p className="font-heading text-3xl tracking-tight tabular-nums">{branchCount}</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-[0.5px] mt-0.5">Succursale{branchCount > 1 ? "s" : ""}</p>
                  </div>
                </div>
              </div>
              <div className="bg-card border border-border border-l-4 border-l-blue-500 rounded-2xl p-5 hover:-translate-y-0.5 hover:shadow-md transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                    <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="font-heading text-3xl tracking-tight tabular-nums">{userCount}</p>
                    <p className="text-xs text-muted-foreground uppercase tracking-[0.5px] mt-0.5">Utilisateur{userCount > 1 ? "s" : ""}</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
