"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  LayoutDashboard, FileText, FilePlus, FileEdit, Users, Bell,
  Building2, Building, LogOut, Menu, X, UserCircle, BarChart3, ClipboardCheck, CalendarDays, CalendarRange,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/use-profile";
import { ROLE_LABELS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { BranchSelector } from "@/components/layout/BranchSelector";
import { useBranch } from "@/lib/context/branch-context";

const mainNav = [
  { name: "Tableau de bord", href: "/",               icon: LayoutDashboard },
  { name: "Statut des Fiches", href: "/fiches",        icon: FileText },
  { name: "Nouvelle fiche",  href: "/fiches/nouvelle", icon: FilePlus },
  { name: "Brouillons",     href: "/fiches?status=BROUILLON", icon: FileEdit },
];

const suivisNav = [
  { name: "Notifications", href: "/notifications", icon: Bell,       badge: "notifs" },
  { name: "Mon profil",    href: "/profil",         icon: UserCircle },
];

const planningNav = [
  { name: "Planification", href: "/planification", icon: CalendarDays },
  { name: "Calendrier",    href: "/calendrier",     icon: CalendarRange },
];

const adminNav = [
  { name: "Utilisateurs",  href: "/utilisateurs",  icon: Users },
  { name: "Reporting",     href: "/reporting",     icon: BarChart3 },
];

// Réservé à la Direction Générale
const dgNav = [
  { name: "Société",      href: "/admin/societe",      icon: Building },
  { name: "Succursales",  href: "/admin/succursales",  icon: Building2 },
];

const commercialNav = [
  { name: "Mon reporting", href: "/reporting", icon: BarChart3 },
];

type BadgeKey = "fiches" | "notifs" | "soumises";

function NavItem({
  item, isActive, badge, badgeRed, onClick,
}: {
  item: { name: string; href: string; icon: React.ElementType };
  isActive: boolean;
  badge?: number;
  badgeRed?: number;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "relative flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium tracking-tight transition-all duration-200",
        isActive
          ? "bg-white/10 text-white"
          : "text-white/70 hover:text-white hover:bg-white/8",
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#F97316] rounded-r-full" />
      )}
      <Icon className="w-4.5 h-4.5 shrink-0" />
      <span className="flex-1">{item.name}</span>
      {badge !== undefined && badge > 0 && (
        <span className="bg-[#F97316] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
          {badge}
        </span>
      )}
      {badgeRed !== undefined && badgeRed > 0 && (
        <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
          {badgeRed}
        </span>
      )}
    </Link>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="px-4 pt-5 pb-1 text-[10px] font-bold tracking-widest uppercase text-white/45 select-none">
      {label}
    </p>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profile, loading: profileLoading, organizationName } = useProfile();
  const { isDG } = useBranch();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [badges, setBadges] = useState<Record<BadgeKey, number>>({ fiches: 0, notifs: 0, soumises: 0 });
  const supabase = useMemo(() => createClient(), []);

  const fetchBadgesRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (!profile) return;
    async function fetchBadges() {
      let ficheQuery = supabase.from("fiches").select("id", { count: "exact", head: true });
      if (profile?.role === "PROSPECTEUR") {
        ficheQuery = ficheQuery.eq("created_by", profile.id);
      } else {
        ficheQuery = ficheQuery.neq("status", "BROUILLON");
      }

      const [{ count: ficheCount }, { count: notifCount }, { count: soumisesCount }] = await Promise.all([
        ficheQuery,
        supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", profile!.id).eq("read", false),
        profile?.role === "DIRECTION" || profile?.role === "SUPER_ADMIN"
          ? supabase.from("fiches").select("id", { count: "exact", head: true }).eq("status", "SOUMISE")
          : Promise.resolve({ count: 0 }),
      ]);
      setBadges({ fiches: ficheCount ?? 0, notifs: notifCount ?? 0, soumises: soumisesCount ?? 0 });
    }
    fetchBadgesRef.current = fetchBadges;
    fetchBadges();

    const channel = supabase
      .channel(`sidebar-badges-${profile.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "fiches" }, () => {
        fetchBadges();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${profile.id}` }, () => {
        fetchBadges();
      })
      .subscribe();

    // Mise à jour instantanée dans le même onglet après chaque transition de statut
    function onFicheStatusChanged() { void fetchBadges(); }
    window.addEventListener("phc:fiche-status-changed", onFicheStatusChanged);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("phc:fiche-status-changed", onFicheStatusChanged);
    };
  }, [profile, supabase]);

  useEffect(() => {
    fetchBadgesRef.current?.();
  }, [pathname]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  function badgeFor(key?: string) {
    if (key === "fiches")   return badges.fiches;
    if (key === "notifs")   return badges.notifs;
    return undefined;
  }

  const close = () => setMobileOpen(false);

  const sidebarContent = (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Lueur subtile en haut à droite */}
      <div className="pointer-events-none absolute -top-16 -right-16 w-40 h-40 rounded-full bg-[#F97316] opacity-[.07] blur-2xl" />

      {/* Brand */}
      <div className="px-5 py-4 border-b border-white/8">
        <Link href="/" className="flex items-center gap-3" onClick={close}>
          <BrandLogo size={42} />
          <div>
            <h1 className="text-sm font-bold text-white tracking-tight leading-tight">PROXIMITÉ HABITAT</h1>
            <p className="text-[10px] font-semibold text-white/60 tracking-widest">CONSEIL</p>
          </div>
        </Link>
        {!isDG && organizationName && (
          <div className="mt-2 px-2 py-1 rounded-md bg-white/10 border border-white/15">
            <p className="text-[11px] font-semibold text-white text-center truncate">{organizationName}</p>
          </div>
        )}
      </div>

      {/* Sélecteur de succursale (DG uniquement) */}
      <BranchSelector />

      {/* Navigation principale */}
      <nav className="flex-1 px-3 pt-3 pb-2 overflow-y-auto">
          <>
            <div className="space-y-0.5">
              {/* Tableau de bord */}
              <NavItem
                item={mainNav[0]}
                isActive={isActive(mainNav[0].href)}
                onClick={close}
              />
              {/* Fiches à valider (admin + DG) — au-dessus de Statut des Fiches */}
              {(profile?.role === "DIRECTION" || profile?.role === "SUPER_ADMIN" || profile?.role === "DIRECTION_GENERALE") && (
                <NavItem
                  item={{ name: "Fiches à valider", href: "/fiches?status=SOUMISE", icon: ClipboardCheck }}
                  isActive={pathname === "/fiches" && searchParams.get("status") === "SOUMISE"}
                  badgeRed={badges.soumises}
                  onClick={close}
                />
              )}
              {/* Statut des Fiches */}
              <NavItem
                item={mainNav[1]}
                isActive={isActive(mainNav[1].href) && searchParams.get("status") !== "SOUMISE"}
                onClick={close}
              />
              {/* Nouvelle fiche — Référent et Chef d'équipe (pas DG) */}
              {(profile?.role === "PROSPECTEUR" || profile?.role === "CHEF_EQUIPE") && (
                <NavItem
                  item={mainNav[2]}
                  isActive={isActive(mainNav[2].href)}
                  onClick={close}
                />
              )}
              {/* Brouillons */}
              <NavItem
                item={mainNav[3]}
                isActive={pathname === "/fiches" && searchParams.get("status") === "BROUILLON"}
                onClick={close}
              />
            </div>

            <SectionLabel label="Suivi" />
            <div className="space-y-0.5">
              {suivisNav
                .filter((item) => !(profile?.role === "DIRECTION_GENERALE" && item.href === "/notifications"))
                .map((item) => (
                <NavItem
                  key={item.href}
                  item={item}
                  isActive={isActive(item.href)}
                  badge={badgeFor((item as { badge?: string }).badge)}
                  onClick={close}
                />
              ))}
            </div>

            <SectionLabel label="Planning" />
            <div className="space-y-0.5">
              {planningNav.map((item) => (
                <NavItem key={item.href} item={item} isActive={isActive(item.href)} onClick={close} />
              ))}
            </div>

            {(profile?.role === "SUPER_ADMIN" || profile?.role === "DIRECTION" || profile?.role === "DIRECTION_GENERALE") && (
              <>
                <SectionLabel label="Administration" />
                <div className="space-y-0.5">
                  {adminNav.map((item) => (
                    <NavItem key={item.href} item={item} isActive={isActive(item.href)} onClick={close} />
                  ))}
                </div>
              </>
            )}
            {profile?.role === "DIRECTION_GENERALE" && (
              <>
                <SectionLabel label="Direction Générale" />
                <div className="space-y-0.5">
                  {dgNav.map((item) => (
                    <NavItem key={item.href} item={item} isActive={isActive(item.href)} onClick={close} />
                  ))}
                </div>
              </>
            )}
            {profile?.role === "COMMERCIAL" && (
              <>
                <SectionLabel label="Statistiques" />
                <div className="space-y-0.5">
                  {commercialNav.map((item) => (
                    <NavItem key={item.href} item={item} isActive={isActive(item.href)} onClick={close} />
                  ))}
                </div>
              </>
            )}
          </>
      </nav>

      {/* Footer utilisateur */}
      <div className="px-3 py-3 border-t border-white/8 space-y-0.5">
        {profile ? (
          <>
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-[#F97316] flex items-center justify-center text-xs font-bold text-white shrink-0">
                {profile.first_name[0]}{profile.last_name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold tracking-tight text-white truncate leading-tight">
                  {profile.first_name} {profile.last_name}
                </p>
                <p className="text-xs text-white/55">{ROLE_LABELS[profile.role]}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/8 transition-all duration-200 w-full"
            >
              <LogOut className="w-4.5 h-4.5" />
              Déconnexion
            </button>
          </>
        ) : (
          null
        )}
      </div>
    </div>
  );

  return (
    <>
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Ouvrir le menu"
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white shadow-lg"
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
