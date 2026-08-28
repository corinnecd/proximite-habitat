"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Bandeau d'erreur de chargement, partagé par toutes les pages.
 *
 * Un échec réseau ne doit jamais se traduire par une page vide sans explication :
 * l'utilisateur doit savoir que la donnée manque, et pouvoir réessayer sans
 * recharger l'application. `onRetry` est optionnel — sans lui, le bouton est masqué.
 */
export function ErrorBanner({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-center gap-3 rounded-xl px-4 py-3 text-sm",
        "bg-red-50 text-red-700 ring-1 ring-red-200/60",
        "dark:bg-red-950/30 dark:text-red-300 dark:ring-red-900/40",
        className,
      )}
    >
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span className="flex-1 min-w-0">{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            "shrink-0 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium",
            "ring-1 ring-red-300/70 hover:bg-red-100 transition-colors",
            "dark:ring-red-800/60 dark:hover:bg-red-900/40",
          )}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Réessayer
        </button>
      )}
    </div>
  );
}
