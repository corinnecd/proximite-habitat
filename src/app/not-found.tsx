import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center space-y-8 max-w-md">

        {/* Illustration SVG */}
        <div className="relative mx-auto w-56 h-44">
          <svg viewBox="0 0 224 176" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
            {/* Shadow */}
            <ellipse cx="112" cy="168" rx="70" ry="8" fill="#1E3A5F" opacity="0.06" />
            {/* Page */}
            <rect x="44" y="24" width="136" height="132" rx="12" fill="white" stroke="#E5E2DB" strokeWidth="1.5" />
            {/* Lines */}
            <rect x="64" y="52" width="96" height="8" rx="4" fill="#F1F0ED" />
            <rect x="64" y="68" width="72" height="7" rx="3.5" fill="#F1F0ED" />
            <rect x="64" y="90" width="96" height="7" rx="3.5" fill="#F1F0ED" />
            <rect x="64" y="104" width="56" height="7" rx="3.5" fill="#F1F0ED" />
            {/* Big 404 */}
            <text x="60" y="148" fontSize="52" fontWeight="800" fontFamily="system-ui" fill="#1E3A5F" opacity="0.08" letterSpacing="-2">404</text>
            {/* Orange circle accent */}
            <circle cx="164" cy="52" r="24" fill="#F97316" opacity="0.12" />
            <text x="152" y="59" fontSize="20" fontFamily="system-ui">🔍</text>
            {/* Broken link icon */}
            <circle cx="64" cy="52" r="10" fill="#EF4444" opacity="0.15" />
            <line x1="60" y1="48" x2="68" y2="56" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
            <line x1="68" y1="48" x2="60" y2="56" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          </svg>
        </div>

        {/* Texte */}
        <div className="space-y-2">
          <h1 className="text-6xl font-bold text-primary" style={{ fontFamily: "var(--font-heading)" }}>404</h1>
          <h2 className="text-xl font-semibold text-foreground">Page introuvable</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            La page que vous cherchez n&apos;existe pas ou a été déplacée.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Retour au tableau de bord
          </Link>
          <Link
            href="/fiches"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-border bg-card text-foreground text-sm font-medium hover:bg-secondary transition-colors"
          >
            Voir les fiches
          </Link>
        </div>

        {/* Brand */}
        <p className="text-xs text-muted-foreground/50">Proximité Habitat Conseil</p>
      </div>
    </div>
  );
}
