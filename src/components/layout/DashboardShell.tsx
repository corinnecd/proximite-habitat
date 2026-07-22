"use client";

import { useProfile } from "@/lib/hooks/use-profile";
import DashboardLoading from "@/app/(dashboard)/loading";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useProfile();

  if (loading || !profile) {
    return <DashboardLoading />;
  }

  return <>{children}</>;
}
