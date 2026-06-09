"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard Error]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center space-y-6 max-w-md">

        {/* Illustration */}
        <div className="relative mx-auto w-40 h-32">
          <svg viewBox="0 0 160 128" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            <ellipse cx="80" cy="120" rx="50" ry="6" fill="currentColor" opacity="0.06" />
            {/* Shield */}
            <path d="M80 16 L116 32 L116 72 C116 94 80 112 80 112 C80 112 44 94 44 72 L44 32 Z" fill="#EF4444" opacity="0.12" />
            <path d="M80 16 L116 32 L116 72 C116 94 80 112 80 112 C80 112 44 94 44 72 L44 32 Z" stroke="#EF4444" strokeWidth="2" fill="none" opacity="0.4" />
            {/* Warning sign inside */}
            <path d="M80 45 L80 72" stroke="#EF4444" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
            <circle cx="80" cy="82" r="3" fill="#EF4444" opacity="0.7" />
            {/* Sparks */}
            <line x1="118" y1="28" x2="126" y2="20" stroke="#F97316" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
            <line x1="124" y1="36" x2="134" y2="34" stroke="#F97316" strokeWidth="2" strokeLinecap="round" opacity="0.3" />
            <line x1="42" y1="28" x2="34" y2="20" stroke="#F97316" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
          </svg>
        </div>

        {/* Texte */}
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h2 className="text-xl font-semibold text-foreground">Une erreur s'est produite</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Une erreur inattendue s'est produite. Vous pouvez réessayer ou retourner au tableau de bord.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground/50 font-mono">ID : {error.digest}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />Réessayer
          </button>
          <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-card text-foreground text-sm font-medium hover:bg-secondary transition-colors">
            <Home className="w-4 h-4" />Tableau de bord
          </Link>
        </div>
      </div>
    </div>
  );
}
