"use client";

import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center mx-auto mb-5">
          <WifiOff className="w-8 h-8 text-orange-500" />
        </div>
        <h1 className="text-xl font-heading font-bold text-foreground mb-2">Vous êtes hors ligne</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Vérifiez votre connexion internet et réessayez. Vos données seront disponibles dès que la connexion sera rétablie.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-5 py-2.5 rounded-xl bg-[#1E3A5F] text-white text-sm font-medium hover:bg-[#1E3A5F]/90 transition-colors"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}
