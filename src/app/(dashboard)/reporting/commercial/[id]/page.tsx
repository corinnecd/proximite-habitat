"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import { ShieldAlert } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { CommercialReportingView } from "@/components/reporting/CommercialReportingView";

interface Profile {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  organization_id: string;
}

export default function CommercialDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile: currentProfile } = useProfile();
  const supabase = useMemo(() => createClient(), []);

  const [commercial, setCommercial] = useState<Profile | null>(null);

  const isAdminOrDG = currentProfile?.role === "DIRECTION" || currentProfile?.role === "SUPER_ADMIN" || currentProfile?.role === "DIRECTION_GENERALE";

  useLayoutEffect(() => {
    if (!id) return;
    try {
      const raw = localStorage.getItem(`comm_dash_profile_${id}`);
      if (!raw) return;
      setCommercial(JSON.parse(raw));
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => {
    if (!currentProfile) return;
    if (!isAdminOrDG) { router.replace("/"); return; }
  }, [currentProfile, isAdminOrDG, router]);

  useEffect(() => {
    if (!id) return;
    supabase.from("profiles").select("id, first_name, last_name, role, organization_id").eq("id", id).single()
      .then(({ data }) => {
        if (!data) return;
        setCommercial(data as Profile);
        try { localStorage.setItem(`comm_dash_profile_${id}`, JSON.stringify(data)); } catch { /* ignore */ }
      });
  }, [id, supabase]);

  // `return null` rendait une page blanche pendant le chargement du profil, ce
  // qu'interdit la règle zéro-flash. On distingue les deux cas : structure visible
  // pendant le chargement, message explicite si l'accès est refusé.
  if (!currentProfile) {
    return <Topbar titleAs="p" title="Commercial" />;
  }
  if (!isAdminOrDG) {
    return (
      <>
        <Topbar titleAs="p" title="Accès refusé" />
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="max-w-md mx-auto text-center py-16 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
              <ShieldAlert className="w-7 h-7 text-muted-foreground" />
            </div>
            <h2 className="font-heading text-xl">Accès non autorisé</h2>
            <p className="text-sm text-muted-foreground">
              Ce reporting est réservé à la direction.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <CommercialReportingView
      subjectId={id}
      viewerProfileId={currentProfile.id}
      topbarTitle={commercial ? `${commercial.first_name} ${commercial.last_name}` : "Commercial"}
      backHref="/reporting"
      backLabel="Retour au Tableau de Bord Direction"
    />
  );
}
