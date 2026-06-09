export const dynamic = "force-dynamic";

import { Sidebar } from "@/components/layout/Sidebar";
import { SearchProvider } from "@/components/layout/SearchProvider";
import { ScrollToTop } from "@/components/ui/scroll-to-top";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SearchProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className="lg:pl-72"><main className="min-h-screen">{children}</main></div>
        <ScrollToTop />
      </div>
    </SearchProvider>
  );
}
