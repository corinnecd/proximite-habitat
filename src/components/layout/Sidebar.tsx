"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, FileText, FilePlus, Users, Bell, Building2, LogOut, Menu, X, UserCircle, BarChart3 } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import { ROLE_LABELS } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Tableau de bord", href: "/", icon: LayoutDashboard },
  { name: "Fiches", href: "/fiches", icon: FileText },
  { name: "Nouvelle fiche", href: "/fiches/nouvelle", icon: FilePlus },
  { name: "Notifications", href: "/notifications", icon: Bell },
  { name: "Mon profil", href: "/profil", icon: UserCircle },
];

const adminNavigation = [
  { name: "Utilisateurs", href: "/utilisateurs", icon: Users },
  { name: "Reporting", href: "/reporting", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useProfile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const allNav = [...navigation, ...(profile?.role === "ADMIN" ? adminNavigation : [])];

  const sidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-white/10">
        <Link href="/" className="flex items-center gap-3" onClick={() => setMobileOpen(false)}>
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white tracking-tight">Proximité Habitat</h1>
            <p className="text-xs text-white/50">Conseil</p>
          </div>
        </Link>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {allNav.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
              className={cn("flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                isActive ? "bg-white/15 text-white shadow-sm" : "text-white/60 hover:text-white hover:bg-white/5")}>
              <item.icon className="w-5 h-5 shrink-0" />{item.name}
            </Link>
          );
        })}
      </nav>
      {profile && (
        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="w-9 h-9 rounded-full bg-orange-400/20 flex items-center justify-center text-sm font-semibold text-orange-400">
              {profile.first_name[0]}{profile.last_name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{profile.first_name} {profile.last_name}</p>
              <p className="text-xs text-white/40">{ROLE_LABELS[profile.role]}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-white/70 hover:text-white hover:bg-white/5 transition-all duration-200 w-full">
            <LogOut className="w-5 h-5" />Déconnexion
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <button onClick={() => setMobileOpen(true)} aria-label="Ouvrir le menu" className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg">
        <Menu className="w-5 h-5" />
      </button>
      {mobileOpen && <div aria-hidden="true" className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={() => setMobileOpen(false)} />}
      <aside className={cn("lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-[#1E3A5F] transform transition-transform duration-300", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
        <button onClick={() => setMobileOpen(false)} aria-label="Fermer le menu" className="absolute top-4 right-4 text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
        {sidebarContent}
      </aside>
      <aside className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 bg-[#1E3A5F]">{sidebarContent}</aside>
    </>
  );
}
