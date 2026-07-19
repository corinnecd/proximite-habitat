export const dynamic = "force-dynamic";

import { Sidebar } from "@/components/layout/Sidebar";
import { SearchProvider } from "@/components/layout/SearchProvider";
import { ScrollToTop } from "@/components/ui/scroll-to-top";
import { NavigationProgress } from "@/components/layout/NavigationProgress";
import { ProfileProvider } from "@/lib/context/profile-context";
import { BranchProvider } from "@/lib/context/branch-context";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProfileProvider>
      <BranchProvider>
      <SearchProvider>
        <NavigationProgress />
        <div className="min-h-screen bg-background">
          <Sidebar />
          <div className="lg:pl-72"><main className="min-h-screen">{children}</main></div>
          <ScrollToTop />
        </div>
      </SearchProvider>
      </BranchProvider>
    </ProfileProvider>
  );
}
