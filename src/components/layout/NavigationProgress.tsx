"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function Progress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const started = useRef(false);

  // Démarrer la barre immédiatement au clic sur un lien interne
  useEffect(() => {
    function onLinkClick(e: MouseEvent) {
      const a = (e.target as HTMLElement).closest("a[href]");
      if (!a) return;
      const href = a.getAttribute("href") ?? "";
      if (href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto")) return;
      // Même URL : pas de barre
      if (href === pathname || href === `${pathname}?${searchParams}`) return;

      started.current = false;
      if (timer.current) clearInterval(timer.current);
      setVisible(true);
      let p = 8;
      setProgress(p);
      timer.current = setInterval(() => {
        p = Math.min(p + (88 - p) * 0.12, 88);
        setProgress(p);
      }, 80);
    }
    document.addEventListener("click", onLinkClick);
    return () => document.removeEventListener("click", onLinkClick);
  }, [pathname, searchParams]);

  // Compléter la barre quand la navigation est finie (pathname change)
  useEffect(() => {
    if (started.current) {
      // Navigation terminée : compléter jusqu'à 100 puis masquer
      if (timer.current) clearInterval(timer.current);
      setProgress(100);
      const t = setTimeout(() => { setVisible(false); setProgress(0); }, 350);
      return () => clearTimeout(t);
    }
    started.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  return null;
}

export function NavigationProgress() {
  return (
    <Suspense>
      <Progress />
    </Suspense>
  );
}
