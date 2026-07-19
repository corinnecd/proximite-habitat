import React, { type ReactNode } from "react";

// ── SVG illustrations — style Proximité Habitat ────────────────────────────────
// Chaque illustration utilise deux teintes brand : navy #0F1E3D + orange #F97316
// Design : dossier / cloche / carte / recherche — épuré avec ombre au sol

function IlluFiches() {
  return (
    <svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-44 h-32 mx-auto" aria-hidden="true">
      <ellipse cx="100" cy="128" rx="70" ry="6" className="fill-black/[0.04] dark:fill-white/5" />
      {/* Dossier orange soft */}
      <path d="M 40 55 L 80 55 L 90 45 L 160 45 L 160 118 L 40 118 Z" className="fill-orange-100 dark:fill-orange-900/30" />
      <path d="M 40 55 L 80 55 L 90 45 L 160 45 L 160 118 L 40 118 Z" fill="none" className="stroke-orange-500" strokeWidth="1.5" />
      {/* Lignes du dossier */}
      <rect x="55" y="65" width="90" height="4" rx="2" className="fill-orange-300 dark:fill-orange-700/60" />
      <rect x="55" y="75" width="70" height="4" rx="2" className="fill-orange-300 dark:fill-orange-700/60" />
      {/* Loupe navy */}
      <circle cx="140" cy="95" r="18" fill="none" className="stroke-[#0F1E3D] dark:stroke-white" strokeWidth="2.5" />
      <line x1="153" y1="108" x2="163" y2="118" className="stroke-[#0F1E3D] dark:stroke-white" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function IlluNotifications() {
  return (
    <svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-44 h-32 mx-auto" aria-hidden="true">
      <ellipse cx="100" cy="128" rx="70" ry="6" className="fill-black/[0.04] dark:fill-white/5" />
      {/* Cloche */}
      <path d="M 100 42 C 80 42, 68 58, 68 78 L 68 92 L 62 100 L 138 100 L 132 92 L 132 78 C 132 58, 120 42, 100 42 Z"
            className="fill-blue-100 dark:fill-blue-950/50" />
      <path d="M 100 42 C 80 42, 68 58, 68 78 L 68 92 L 62 100 L 138 100 L 132 92 L 132 78 C 132 58, 120 42, 100 42 Z"
            fill="none" className="stroke-blue-600 dark:stroke-blue-400" strokeWidth="1.5" />
      {/* Battant */}
      <path d="M 92 100 C 92 106, 96 110, 100 110 C 104 110, 108 106, 108 100 Z"
            className="fill-blue-600 dark:fill-blue-400" />
      {/* Pastille orange */}
      <circle cx="100" cy="35" r="4" fill="#F97316" />
      {/* Petits rayons */}
      <path d="M 138 60 L 148 55 M 62 60 L 52 55 M 148 75 L 158 75 M 42 75 L 52 75"
            className="stroke-slate-400 dark:stroke-slate-500" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IlluSearch() {
  return (
    <svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-44 h-32 mx-auto" aria-hidden="true">
      <ellipse cx="100" cy="128" rx="70" ry="6" className="fill-black/[0.04] dark:fill-white/5" />
      {/* Doc 1 gris tourné */}
      <rect x="55" y="60" width="45" height="55" rx="4" className="fill-slate-100 dark:fill-slate-800" transform="rotate(-8 77 87)" />
      <rect x="55" y="60" width="45" height="55" rx="4" fill="none" className="stroke-slate-400" strokeWidth="1.5" transform="rotate(-8 77 87)" />
      {/* Doc 2 warning droit */}
      <rect x="95" y="55" width="45" height="55" rx="4" className="fill-amber-100 dark:fill-amber-950/40" />
      <rect x="95" y="55" width="45" height="55" rx="4" fill="none" className="stroke-amber-700 dark:stroke-amber-500" strokeWidth="1.5" />
      <line x1="102" y1="68" x2="132" y2="68" className="stroke-amber-700 dark:stroke-amber-500" strokeWidth="1" />
      <line x1="102" y1="75" x2="128" y2="75" className="stroke-amber-700 dark:stroke-amber-500" strokeWidth="1" />
      <line x1="102" y1="82" x2="130" y2="82" className="stroke-amber-700 dark:stroke-amber-500" strokeWidth="1" />
      {/* Loupe avec croix orange */}
      <circle cx="130" cy="102" r="20" className="fill-background" />
      <circle cx="130" cy="102" r="20" className="stroke-[#0F1E3D] dark:stroke-white" strokeWidth="2.5" fill="none" />
      <line x1="145" y1="117" x2="158" y2="130" className="stroke-[#0F1E3D] dark:stroke-white" strokeWidth="3" strokeLinecap="round" />
      <path d="M 122 102 L 138 102 M 130 94 L 130 110" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function IlluPlanning() {
  return (
    <svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-44 h-32 mx-auto" aria-hidden="true">
      <ellipse cx="100" cy="128" rx="70" ry="6" className="fill-black/[0.04] dark:fill-white/5" />
      {/* Carte planning vert soft */}
      <rect x="45" y="42" width="110" height="76" rx="8" className="fill-emerald-100 dark:fill-emerald-950/40" />
      <rect x="45" y="42" width="110" height="76" rx="8" fill="none" className="stroke-emerald-700 dark:stroke-emerald-500" strokeWidth="1.5" />
      {/* Séparateur haut */}
      <line x1="45" y1="60" x2="155" y2="60" className="stroke-emerald-700 dark:stroke-emerald-500" strokeWidth="1.5" />
      {/* Onglets calendrier */}
      <rect x="60" y="48" width="10" height="6" rx="2" className="fill-emerald-700 dark:fill-emerald-500" />
      <rect x="130" y="48" width="10" height="6" rx="2" className="fill-emerald-700 dark:fill-emerald-500" />
      {/* Drapeau orange */}
      <path d="M 90 78 L 90 106 M 90 78 L 118 82 L 108 92 L 118 100 L 90 96" fill="#F97316" stroke="#C2410C" strokeWidth="1" />
      {/* Micro points */}
      <circle cx="70" cy="90" r="2" className="fill-slate-400" />
      <circle cx="130" cy="105" r="2" className="fill-slate-400" />
    </svg>
  );
}

function IlluUsers() {
  return (
    <svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-44 h-32 mx-auto" aria-hidden="true">
      <ellipse cx="100" cy="128" rx="70" ry="6" className="fill-black/[0.04] dark:fill-white/5" />
      {/* Personne 1 (arrière gauche) */}
      <circle cx="65" cy="60" r="14" className="fill-purple-100 dark:fill-purple-950/40" />
      <circle cx="65" cy="60" r="14" fill="none" className="stroke-purple-600 dark:stroke-purple-400" strokeWidth="1.5" />
      <path d="M 45 100 C 45 90, 55 82, 65 82 C 75 82, 85 90, 85 100" className="fill-purple-100 dark:fill-purple-950/40" />
      <path d="M 45 100 C 45 90, 55 82, 65 82 C 75 82, 85 90, 85 100" fill="none" className="stroke-purple-600 dark:stroke-purple-400" strokeWidth="1.5" />
      {/* Personne 2 (avant droite) - featured */}
      <circle cx="130" cy="50" r="16" className="fill-orange-100 dark:fill-orange-950/40" />
      <circle cx="130" cy="50" r="16" fill="none" className="stroke-[#F97316]" strokeWidth="2" />
      <path d="M 108 100 C 108 88, 118 78, 130 78 C 142 78, 152 88, 152 100" className="fill-orange-100 dark:fill-orange-950/40" />
      <path d="M 108 100 C 108 88, 118 78, 130 78 C 142 78, 152 88, 152 100" fill="none" className="stroke-[#F97316]" strokeWidth="2" />
      {/* Plus icon */}
      <circle cx="152" cy="72" r="10" fill="#F97316" />
      <path d="M 148 72 L 156 72 M 152 68 L 152 76" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

type IlluType = "fiches" | "search" | "notifications" | "planning" | "users";

const ILLUS: Record<IlluType, () => React.JSX.Element> = {
  fiches: IlluFiches,
  search: IlluSearch,
  notifications: IlluNotifications,
  planning: IlluPlanning,
  users: IlluUsers,
};

interface EmptyStateProps {
  illustration?: IlluType;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ illustration = "fiches", title, description, action }: EmptyStateProps) {
  const Illu = ILLUS[illustration];
  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-6 text-center space-y-5"
      style={undefined}
    >
      <Illu />
      <div className="space-y-2 max-w-sm">
        <p className="font-heading text-2xl tracking-tight text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>}
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
