"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

/**
 * Basculeur de thème clair ↔ sombre.
 *
 * Les icônes sont gérées en CSS (`dark:hidden` / `dark:block`) plutôt qu'en
 * JS, ce qui évite tout mismatch d'hydratation et supprime le pattern
 * `useEffect(() => setState, [])` signalé par le React Compiler.
 * `next-themes` applique la classe `.dark` sur `<html>` avant le premier
 * paint, donc le bon icône est visible immédiatement.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  function toggle() {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="p-2 rounded-xl hover:bg-secondary transition-colors text-muted-foreground"
      aria-label="Basculer le thème clair / sombre"
      title="Basculer le thème"
    >
      {/* Lune visible en mode clair, cachée en mode sombre */}
      <Moon className="w-5 h-5 block dark:hidden" />
      {/* Soleil visible en mode sombre, caché en mode clair */}
      <Sun  className="w-5 h-5 hidden dark:block" />
    </button>
  );
}
