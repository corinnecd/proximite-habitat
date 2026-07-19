"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function Progress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>>();
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
      clearInterval(timer.current);
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
      clearInterval(timer.current);
      setProgress(100);
      const t = setTimeout(() => { setVisible(false); setProgress(0); }, 350);
      return () => clearTimeout(t);
    }
    started.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: "0 auto auto 0",
        height: 3,
        width: `${progress}%`,
        background: "#F97316",
        zIndex: 9999,
        pointerEvents: "none",
        transition: progress === 100
          ? "width 150ms ease-out"
          : "width 80ms linear",
        borderRadius: "0 2px 2px 0",
        boxShadow: "0 0 8px rgba(249,115,22,0.6)",
      }}
    />
  );
}

export function NavigationProgress() {
  return (
    <Suspense>
      <Progress />
    </Suspense>
  );
}
