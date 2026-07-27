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
