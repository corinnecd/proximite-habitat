"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
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

  if (!currentProfile || !isAdminOrDG) return null;

  return (
    <CommercialReportingView
      subjectId={id}
      topbarTitle={commercial ? `${commercial.first_name} ${commercial.last_name}` : "Commercial"}
      backHref="/reporting"
      backLabel="Retour au Tableau de Bord Direction"
    />
  );
}
