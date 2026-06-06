"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Topbar } from "@/components/layout/Topbar";
import { FicheStatusBadge } from "@/components/fiches/FicheStatusBadge";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import type { FicheStatus } from "@/types/database";
import { FileText, FilePlus, Clock, CheckCircle2, XCircle, Send, UserCheck, Archive, History, Trash2 } from "lucide-react";

const STATUS_ICONS: Record<FicheStatus, React.ReactNode> = {
  BROUILLON: <Clock className="w-5 h-5" />, SOUMISE: <Send className="w-5 h-5" />,
  AFFECTEE: <UserCheck className="w-5 h-5" />, ACCEPTEE: <CheckCircle2 className="w-5 h-5" />,
  REFUSEE: <XCircle className="w-5 h-5" />, ARCHIVEE: <Archive className="w-5 h-5" />,
};

const COUNTER_STYLES: Record<FicheStatus, string> = {
  BROUILLON: "bg-gray-50 text-gray-600 border-gray-200", SOUMISE: "bg-blue-50 text-blue-600 border-blue-200",
  AFFECTEE: "bg-orange-50 text-orange-600 border-orange-200", ACCEPTEE: "bg-green-50 text-green-600 border-green-200",
  REFUSEE: "bg-red-50 text-red-600 border-red-200", ARCHIVEE: "bg-gray-50 text-gray-400 border-gray-200",
};

interface FicheRow {
  id: string; reference: string; status: FicheStatus;
  prospect_nom: string; prospect_prenom: string; prospect_ville: string;
  created_at: string; created_by: string;
}

export default function DashboardPage() {
  const { profile, loading: profileLoading } = useProfile();
  const [counts, setCounts] = useState<Record<FicheStatus, number>>({ BROUILLON: 0, SOUMISE: 0, AFFECTEE: 0, ACCEPTEE: 0, REFUSEE: 0, ARCHIVEE: 0 });
  const [recentFiches, setRecentFiches] = useState<FicheRow[]>([]);
  const [historyFiches, setHistoryFiches] = useState<FicheRow[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchData = useCallback(async () => {
    if (!profile) return;
    const isProspecteur = profile.role === "PROSPECTEUR";

    // Prospecteur : voit tous ses propres statuts (brouillons + historique)
    // Admin/Commercial : ne voient PAS les brouillons (visibles uniquement par le créateur)
    const statusesToCount: FicheStatus[] = isProspecteur
      ? ["BROUILLON", "SOUMISE", "AFFECTEE", "ACCEPTEE", "REFUSEE", "ARCHIVEE"]
      : ["SOUMISE", "AFFECTEE", "ACCEPTEE", "REFUSEE", "ARCHIVEE"];

    const countPromises = statusesToCount.map(async (s) => {
      let query = supabase.from("fiches").select("*", { count: "exact", head: true }).eq("status", s);
      if (isProspecteur) {
        query = query.eq("created_by", profile.id);
      }
      const { count } = await query;
      return [s, count || 0] as const;
    });

    const results = await Promise.all(countPromises);
    const allCounts: Record<FicheStatus, number> = { BROUILLON: 0, SOUMISE: 0, AFFECTEE: 0, ACCEPTEE: 0, REFUSEE: 0, ARCHIVEE: 0 };
    results.forEach(([s, c]) => { allCounts[s] = c; });
    setCounts(allCounts);

    // Prospecteur : section principale = uniquement ses brouillons EN COURS
    // Admin/Commercial : fiches récentes excluant les brouillons (réservés au créateur)
    let recentQuery = supabase.from("fiches")
      .select("id, reference, status, prospect_nom, prospect_prenom, prospect_ville, created_at, created_by")
      .order("created_at", { ascending: false })
      .limit(5);

    if (isProspecteur) {
      recentQuery = recentQuery.eq("created_by", profile.id).eq("status", "BROUILLON");
    } else {
      recentQuery = recentQuery.neq("status", "BROUILLON");
    }

    const { data } = await recentQuery;
    setRecentFiches((data as FicheRow[]) || []);

    // Historique prospecteur (toutes ses fiches soumises et au-delà)
    if (isProspecteur) {
      const { data: history } = await supabase.from("fiches")
        .select("id, reference, status, prospect_nom, prospect_prenom, prospect_ville, created_at, created_by")
        .eq("created_by", profile.id)
        .neq("status", "BROUILLON")
        .order("created_at", { ascending: false })
        .limit(20);
      setHistoryFiches((history as FicheRow[]) || []);
    }

    setLoading(false);
  }, [profile, supabase]);

  useEffect(() => {
    if (profileLoading || !profile) return;
    fetchData();

    // Écouter les changements en temps réel pour rafraîchir le dashboard
    const channel = supabase
      .channel("fiches-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "fiches" }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile, profileLoading, supabase, fetchData]);

  const totalFiches = Object.values(counts).reduce((a, b) => a + b, 0);
  const isProspecteur = profile?.role === "PROSPECTEUR";

  // Compteurs affichés : prospecteur voit ses brouillons, admin/commercial ne voient pas les brouillons
  const visibleStatuses: FicheStatus[] = isProspecteur
    ? ["BROUILLON", "SOUMISE", "AFFECTEE", "ACCEPTEE", "REFUSEE", "ARCHIVEE"]
    : ["SOUMISE", "AFFECTEE", "ACCEPTEE", "REFUSEE", "ARCHIVEE"];

  if (profileLoading || loading) {
    return (<><Topbar title="Tableau de bord" /><div className="p-6 lg:p-8"><div className="animate-pulse space-y-6"><div className="grid grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => (<div key={i} className="h-28 bg-white rounded-xl" />))}</div></div></div></>);
  }

  return (
    <>
      <Topbar title="Tableau de bord" />
      <div className="p-6 lg:p-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-medium text-foreground">Bonjour, {profile?.first_name}</h2>
            <p className="text-muted-foreground">
              {isProspecteur
                ? `${counts.BROUILLON} brouillon${counts.BROUILLON > 1 ? "s" : ""} en cours`
                : `${totalFiches} fiche${totalFiches > 1 ? "s" : ""} au total`}
            </p>
          </div>
          <Link href="/fiches/nouvelle"><Button className="bg-[#F97316] hover:bg-[#EA580C] text-white rounded-xl gap-2"><FilePlus className="w-4 h-4" />Nouvelle fiche</Button></Link>
        </div>

        {/* Compteurs par statut */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {visibleStatuses.map((status) => (
            <Link key={status} href={`/fiches?status=${status}`}>
              <Card className={`border ${COUNTER_STYLES[status]} hover:shadow-md transition-all duration-200 cursor-pointer`}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">{STATUS_ICONS[status]}</div>
                  <p className="text-3xl font-bold">{counts[status]}</p>
                  <p className="text-xs mt-1 opacity-70"><FicheStatusBadge status={status} /></p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Fiches récentes / brouillons en cours */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-heading text-xl">
              {isProspecteur ? "Mes brouillons en cours" : "Fiches récentes"}
            </CardTitle>
            <Link href="/fiches"><Button variant="ghost" size="sm" className="text-muted-foreground">Voir tout →</Button></Link>
          </CardHeader>
          <CardContent>
            {recentFiches.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><FileText className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>{isProspecteur ? "Aucun brouillon en cours" : "Aucune fiche"}</p>
                <Link href="/fiches/nouvelle"><Button variant="outline" className="mt-4 rounded-xl">Créer une fiche</Button></Link>
              </div>
            ) : (
              <div className="space-y-3">{recentFiches.map((fiche) => (
                <div key={fiche.id} className="flex items-center justify-between p-4 rounded-xl hover:bg-secondary/50 transition-colors group">
                  <Link href={`/fiches/${fiche.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center shrink-0"><FileText className="w-5 h-5 text-primary" /></div>
                    <div className="min-w-0"><p className="font-medium text-sm truncate">{fiche.prospect_prenom} {fiche.prospect_nom}</p><p className="text-xs text-muted-foreground">{fiche.reference} · {fiche.prospect_ville}</p></div>
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    <FicheStatusBadge status={fiche.status} />
                    <span className="text-xs text-muted-foreground hidden sm:block">{new Date(fiche.created_at).toLocaleDateString("fr-FR")}</span>
                    {/* Supprimer le brouillon */}
                    {fiche.status === "BROUILLON" && (
                      <button
                        type="button"
                        title="Supprimer le brouillon"
                        onClick={async (e) => {
                          e.preventDefault();
                          if (!window.confirm(`Supprimer définitivement le brouillon "${fiche.reference}" ?`)) return;
                          await supabase.from("fiche_history").delete().eq("fiche_id", fiche.id);
                          await supabase.from("fiches").delete().eq("id", fiche.id);
                          fetchData();
                        }}
                        className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center text-red-400 hover:text-red-600 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}</div>
            )}
          </CardContent>
        </Card>

        {/* Historique prospecteur — fiches soumises et traitées */}
        {isProspecteur && (
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="font-heading text-xl flex items-center gap-2">
                <History className="w-5 h-5" /> Historique de mes fiches
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historyFiches.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground"><p>Aucune fiche soumise pour le moment</p></div>
              ) : (
                <div className="space-y-3">{historyFiches.map((fiche) => (
                  <div key={fiche.id} className="flex items-center justify-between p-4 rounded-xl bg-secondary/30">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center"><FileText className="w-5 h-5 text-primary" /></div>
                      <div><p className="font-medium text-sm">{fiche.prospect_prenom} {fiche.prospect_nom}</p><p className="text-xs text-muted-foreground">{fiche.reference} · {fiche.prospect_ville}</p></div>
                    </div>
                    <div className="flex items-center gap-3">
                      <FicheStatusBadge status={fiche.status} />
                      <span className="text-xs text-muted-foreground hidden sm:block">{new Date(fiche.created_at).toLocaleDateString("fr-FR")}</span>
                    </div>
                  </div>
                ))}</div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
