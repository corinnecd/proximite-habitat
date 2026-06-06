import type { UserRole, FicheStatus } from "@/types/database";

const STATUS_TRANSITIONS: Record<FicheStatus, { to: FicheStatus[]; roles: UserRole[] }[]> = {
  BROUILLON: [{ to: ["SOUMISE"], roles: ["PROSPECTEUR", "COMMERCIAL", "ADMIN"] }],
  SOUMISE: [{ to: ["AFFECTEE"], roles: ["ADMIN"] }, { to: ["BROUILLON"], roles: ["ADMIN"] }],
  AFFECTEE: [{ to: ["ACCEPTEE", "REFUSEE"], roles: ["ADMIN", "COMMERCIAL"] }, { to: ["SOUMISE"], roles: ["ADMIN"] }],
  ACCEPTEE: [{ to: ["ARCHIVEE"], roles: ["ADMIN"] }],
  REFUSEE: [{ to: ["ARCHIVEE"], roles: ["ADMIN"] }, { to: ["AFFECTEE"], roles: ["ADMIN"] }],
  ARCHIVEE: [],
};

export function canTransition(role: UserRole, from: FicheStatus, to: FicheStatus): boolean {
  return STATUS_TRANSITIONS[from].some((t) => t.to.includes(to) && t.roles.includes(role));
}

export function getAvailableTransitions(role: UserRole, currentStatus: FicheStatus): FicheStatus[] {
  return STATUS_TRANSITIONS[currentStatus].filter((t) => t.roles.includes(role)).flatMap((t) => t.to);
}

export function canManageUsers(role: UserRole): boolean { return role === "ADMIN"; }
export function canAssignFiche(role: UserRole): boolean { return role === "ADMIN"; }

export function canEditFiche(role: UserRole, userId: string, ficheCreatedBy: string, ficheAssignedTo: string | null): boolean {
  if (role === "ADMIN") return true;
  if (role === "COMMERCIAL") return ficheCreatedBy === userId || ficheAssignedTo === userId;
  if (role === "PROSPECTEUR") return ficheCreatedBy === userId;
  return false;
}

export const STATUS_LABELS: Record<FicheStatus, string> = {
  BROUILLON: "Brouillon", SOUMISE: "À valider", AFFECTEE: "Affectée",
  ACCEPTEE: "Acceptée par le client", REFUSEE: "Refusée par le client", ARCHIVEE: "Archivée",
};

export const STATUS_COLORS: Record<FicheStatus, string> = {
  BROUILLON: "bg-gray-100 text-gray-700", SOUMISE: "bg-blue-100 text-blue-700",
  AFFECTEE: "bg-orange-100 text-orange-700", ACCEPTEE: "bg-green-100 text-green-700",
  REFUSEE: "bg-red-100 text-red-700", ARCHIVEE: "bg-gray-200 text-gray-500",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Direction", COMMERCIAL: "Commercial", PROSPECTEUR: "Prospecteur",
};
