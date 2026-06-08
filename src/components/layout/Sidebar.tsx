"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, FileText, FilePlus, Users, Bell,
  Building2, LogOut, Menu, X, UserCircle, BarChart3,
} from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import { ROLE_LABELS } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const mainNav = [
  { name: "Tableau de bord", href: "/",               icon: LayoutDashboard },
  { name: "Fiches",          href: "/fiches",          icon: FileText,  badge: "fiches" },
  { name: "Nouvelle fiche",  href: "/fiches/nouvelle", icon: FilePlus },
];

const suivisNav = [
  { name: "Notifications", href: "/notifications", icon: Bell,       badge: "notifs" },
  { name: "Mon profil",    href: "/profil",         icon: UserCircle },
];

const adminNav = [
  { name: "Utilisateurs", href: "/utilisateurs", icon: Users },
  { name: "Reporting",    href: "/reporting",    icon: BarChart3 },
];

type BadgeKey = "fiches" | "notifs";

function NavItem({
  item, isActive, badge, onClick,
}: {
  item: { name: string; href: string; icon: React.ElementType };
  isActive: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
        isActive
          ? "bg-white/10 text-white"
          : "text-white/55 hover:text-white hover:bg-white/6",
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#F97316] rounded-r-full" />
      )}
      <Icon className="w-4.5 h-4.5 shrink-0" />
      <span className="flex-1">{item.name}</span>
      {badge !== undefined && badge > 0 && (
        <span className="bg-[#F97316] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
          {badge}
        </span>
      )}
    </Link>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="px-4 pt-5 pb-1 text-[10px] font-bold tracking-widest uppercase text-white/25 select-none">
      {label}
    </p>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useProfile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [badges, setBadges] = useState<Record<BadgeKey, number>>({ fiches: 0, notifs: 0 });
  const supabase = createClient();

  useEffect(() => {
    if (!profile) return;
    async function fetchBadges() {
      const [{ count: ficheCount }, { count: notifCount }] = await Promise.all([
        supabase.from("fiches").select("id", { count: "exact", head: true }),
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("read", false),
      ]);
      setBadges({ fiches: ficheCount ?? 0, notifs: notifCount ?? 0 });
    }
    fetchBadges();
  }, [profile]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  function badgeFor(key?: string) {
    if (key === "fiches") return badges.fiches;
    if (key === "notifs") return badges.notifs;
    return undefined;
  }

  const close = () => setMobileOpen(false);

  const sidebarContent = (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Lueur subtile en haut à droite */}
      <div className="pointer-events-none absolute -top-16 -right-16 w-40 h-40 rounded-full bg-[#F97316] opacity-[.07] blur-2xl" />

      {/* Brand */}
      <div className="px-5 py-5 border-b border-white/8">
        <Link href="/" className="flex items-center gap-3" onClick={close}>
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0">
            <Building2 className="w-5.5 h-5.5 text-[#FB923C]" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white tracking-tight leading-tight">Proximité Habitat</h1>
            <p className="text-xs text-white/40">Conseil</p>
          </div>
        </Link>
      </div>

      {/* Navigation principale */}
      <nav className="flex-1 px-3 pt-3 pb-2 overflow-y-auto">
        <div className="space-y-0.5">
          {mainNav.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              isActive={isActive(item.href)}
              badge={badgeFor((item as { badge?: string }).badge)}
              onClick={close}
            />
          ))}
        </div>

        <SectionLabel label="Suivi" />
        <div className="space-y-0.5">
          {suivisNav.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              isActive={isActive(item.href)}
              badge={badgeFor((item as { badge?: string }).badge)}
              onClick={close}
            />
          ))}
        </div>

        {profile?.role === "ADMIN" && (
          <>
            <SectionLabel label="Administration" />
            <div className="space-y-0.5">
              {adminNav.map((item) => (
                <NavItem
                  key={item.href}
                  item={item}
                  isActive={isActive(item.href)}
                  onClick={close}
                />
              ))}
            </div>
          </>
        )}
      </nav>

      {/* Footer utilisateur */}
      {profile && (
        <div className="px-3 py-3 border-t border-white/8 space-y-0.5">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-[#F97316] flex items-center justify-center text-xs font-bold text-white shrink-0">
              {profile.first_name[0]}{profile.last_name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate leading-tight">
                {profile.first_name} {profile.last_name}
              </p>
              <p className="text-xs text-white/35">{ROLE_LABELS[profile.role]}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-white/55 hover:text-white hover:bg-white/6 transition-all duration-200 w-full"
          >
            <LogOut className="w-4.5 h-4.5" />
            Déconnexion
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Ouvrir le menu"
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg"
      >
        <Menu className="w-5 h-5" />
      </button>

      {mobileOpen && (
        <div aria-hidden="true" className="lg:hidden fixed inset-0 bg-black/50 z-40" onClick={close} />
      )}

      <aside className={cn(
        "lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-[#1E3A5F] transform transition-transform duration-300",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
      )}>
        <button onClick={close} aria-label="Fermer le menu" className="absolute top-4 right-4 text-white/60 hover:text-white">
          <X className="w-5 h-5" />
        </button>
        {sidebarContent}
      </aside>

      <aside className="hidden lg:flex lg:w-72 lg:flex-col lg:fixed lg:inset-y-0 bg-[#1E3A5F]">
        {sidebarContent}
      </aside>
    </>
  );
}
