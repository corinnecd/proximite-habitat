"use client";

import { useState } from "react";
import Image from "next/image";
import type { FicheStatus } from "@/types/database";

// ── Shared types (fiche detail page) ───────────────────────────────────────────

export interface HistoryEntry {
  id: string;
  action: string;
  old_status: FicheStatus | null;
  new_status: FicheStatus | null;
  comment: string | null;
  created_at: string;
  profiles: { first_name: string; last_name: string } | null;
}
export interface PhotoEntry { id: string; storage_path: string; original_name: string | null; signedUrl: string; }
export interface ProfileEntry { id: string; first_name: string; last_name: string; role: string; }

// ── Small helpers ─────────────────────────────────────────────────────────────

export function PhotoThumb({ url, name }: { url: string; name: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <div className="relative h-32 rounded-xl overflow-hidden bg-muted flex items-center justify-center">
        <span className="text-xs text-muted-foreground text-center px-2">Image indisponible</span>
      </div>
    );
  }
  return (
    <div className="relative h-32 rounded-xl overflow-hidden bg-muted group cursor-zoom-in">
      <Image
        src={url}
        alt={name}
        fill
        sizes="(max-width: 640px) 50vw, 33vw"
        className="object-cover transition-transform duration-300 group-hover:scale-105"
        onError={() => setBroken(true)}
      />
    </div>
  );
}

export function SectionCard({
  icon, iconBg, iconColor, title, children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),0_0_0_1px_rgba(0,0,0,0.04)] p-6 space-y-4 hover:shadow-md transition-all duration-200">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
          <span className={iconColor}>{icon}</span>
        </div>
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-0.5">{label}</p>
      <div className="text-sm font-medium text-foreground">{value || <span className="text-muted-foreground/60">—</span>}</div>
    </div>
  );
}
