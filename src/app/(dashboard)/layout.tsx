export const dynamic = "force-dynamic";

import { Sidebar } from "@/components/layout/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAF9F6]">
      <Sidebar />
      <div className="lg:pl-72"><main className="min-h-screen">{children}</main></div>
    </div>
  );
}
