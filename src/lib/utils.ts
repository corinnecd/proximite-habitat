import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getCachedProfileId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("ph_profile_v1");
    if (!raw) return null;
    return (JSON.parse(raw) as { id?: string }).id ?? null;
  } catch { return null; }
}

/**
 * Le rôle du profil en cache, pour construire une clé de cache par rôle avant
 * même que le profil ne soit rechargé. Si un utilisateur change de rôle, il
 * bascule ainsi sur un nouveau cache au lieu de restaurer celui de l'ancien rôle.
 */
export function getCachedProfileRole(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("ph_profile_v1");
    if (!raw) return null;
    return (JSON.parse(raw) as { role?: string }).role ?? null;
  } catch { return null; }
}
