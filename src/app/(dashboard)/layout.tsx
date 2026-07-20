export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { SearchProvider } from "@/components/layout/SearchProvider";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { ProfileProvider } from "@/lib/context/profile-context";
import { BranchProvider } from "@/lib/context/branch-context";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProfileProvider>
      <BranchProvider>
      <SearchProvider>
        <div className="min-h-screen bg-background">
          <Suspense fallback={<aside className="hidden lg:flex lg:w-72 lg:fixed lg:inset-y-0 bg-[#1E3A5F]" />}>
            <Sidebar />
          </Suspense>
          <div className="lg:pl-72"><main className="min-h-screen">{children}</main></div>
          <ScrollToTop />
        </div>
      </SearchProvider>
      </BranchProvider>
    </ProfileProvider>
  );
}
