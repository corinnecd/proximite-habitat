import React, { type ReactNode } from "react";

// ── SVG illustrations ─────────────────────────────────────────────────────────

function IlluFiches() {
  return (
    <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-40 h-32 mx-auto">
      {/* Shadow */}
      <ellipse cx="100" cy="148" rx="55" ry="8" fill="currentColor" opacity="0.06" />
      {/* Back doc */}
      <rect x="60" y="28" width="88" height="108" rx="8" fill="currentColor" opacity="0.08" transform="rotate(-6 60 28)" />
      {/* Mid doc */}
      <rect x="55" y="24" width="88" height="108" rx="8" fill="currentColor" opacity="0.12" transform="rotate(-2 55 24)" />
      {/* Front doc */}
      <rect x="52" y="20" width="96" height="116" rx="10" fill="white" stroke="currentColor" strokeOpacity="0.15" strokeWidth="1.5" />
      {/* Lines */}
      <rect x="68" y="44" width="64" height="6" rx="3" fill="currentColor" opacity="0.18" />
      <rect x="68" y="58" width="48" height="5" rx="2.5" fill="currentColor" opacity="0.12" />
      <rect x="68" y="76" width="64" height="5" rx="2.5" fill="currentColor" opacity="0.10" />
      <rect x="68" y="88" width="40" height="5" rx="2.5" fill="currentColor" opacity="0.10" />
      <rect x="68" y="106" width="56" height="5" rx="2.5" fill="currentColor" opacity="0.08" />
      {/* Magnifier */}
      <circle cx="138" cy="112" r="18" fill="#F97316" opacity="0.15" />
      <circle cx="138" cy="112" r="12" stroke="#F97316" strokeWidth="2.5" fill="none" opacity="0.7" />
      <line x1="147" y1="121" x2="154" y2="128" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

function IlluNotifications() {
  return (
    <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-40 h-32 mx-auto">
      <ellipse cx="100" cy="148" rx="50" ry="7" fill="currentColor" opacity="0.06" />
      {/* Bell body */}
      <path d="M100 30 C75 30 60 50 60 72 L60 100 L50 110 L150 110 L140 100 L140 72 C140 50 125 30 100 30Z" fill="currentColor" opacity="0.10" />
      <path d="M100 30 C75 30 60 50 60 72 L60 100 L50 110 L150 110 L140 100 L140 72 C140 50 125 30 100 30Z" stroke="currentColor" strokeOpacity="0.20" strokeWidth="1.5" fill="none" />
      {/* Clapper */}
      <path d="M88 110 Q88 122 100 122 Q112 122 112 110" stroke="currentColor" strokeOpacity="0.20" strokeWidth="1.5" fill="none" />
      {/* Zzz */}
      <text x="118" y="55" fontSize="12" fill="#F97316" opacity="0.6" fontFamily="system-ui" fontWeight="bold">z</text>
      <text x="128" y="44" fontSize="10" fill="#F97316" opacity="0.4" fontFamily="system-ui" fontWeight="bold">z</text>
      <text x="136" y="35" fontSize="8" fill="#F97316" opacity="0.25" fontFamily="system-ui" fontWeight="bold">z</text>
      {/* Check circle */}
      <circle cx="64" cy="62" r="14" fill="#10B981" opacity="0.15" />
      <path d="M58 62 L62 66 L70 58" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
    </svg>
  );
}

function IlluSearch() {
  return (
    <svg viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-40 h-32 mx-auto">
      <ellipse cx="100" cy="148" rx="52" ry="7" fill="currentColor" opacity="0.06" />
      {/* Circle */}
      <circle cx="92" cy="76" r="42" fill="currentColor" opacity="0.07" />
      <circle cx="92" cy="76" r="36" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2" fill="none" />
      {/* Lines inside */}
      <rect x="76" y="68" width="32" height="5" rx="2.5" fill="currentColor" opacity="0.15" />
      <rect x="76" y="79" width="22" height="5" rx="2.5" fill="currentColor" opacity="0.10" />
      {/* Handle */}
      <line x1="120" y1="104" x2="148" y2="132" stroke="currentColor" strokeOpacity="0.25" strokeWidth="5" strokeLinecap="round" />
      {/* X mark */}
      <line x1="84" y1="68" x2="100" y2="84" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
      <line x1="100" y1="68" x2="84" y2="84" stroke="#F97316" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

type IlluType = "fiches" | "search" | "notifications";

const ILLUS: Record<IlluType, () => React.JSX.Element> = {
  fiches: IlluFiches,
  search: IlluSearch,
  notifications: IlluNotifications,
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
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-5" style={{ animation: "fadeIn 0.3s ease both" }}>
      <div className="text-muted-foreground/50">
        <Illu />
      </div>
      <div className="space-y-1.5">
        <p className="text-lg font-semibold tracking-tight text-foreground">{title}</p>
        {description && <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">{description}</p>}
      </div>
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
