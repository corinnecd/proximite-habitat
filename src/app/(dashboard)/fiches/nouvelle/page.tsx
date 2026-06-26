"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { FicheStepper } from "@/components/forms/FicheStepper";
import { Card, CardContent } from "@/components/ui/card";
import { useProfile } from "@/lib/hooks/use-profile";

const ALLOWED_ROLES = ["PROSPECTEUR", "CHEF_EQUIPE"] as const;

export default function NouvelleFichePage() {
  const router = useRouter();
  const { profile, loading } = useProfile();
  const allowed = profile && (ALLOWED_ROLES as readonly string[]).includes(profile.role);

  useEffect(() => {
    if (!loading && profile && !allowed) router.replace("/");
  }, [loading, profile, allowed, router]);

  if (loading || !profile || !allowed) return null;

  return (
    <>
      <Topbar title="Nouvelle fiche de pré-visite" />
      <div className="p-6 lg:p-8 max-w-4xl mx-auto">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 lg:p-10">
            <FicheStepper />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
