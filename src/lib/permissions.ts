import type { UserRole, FicheStatus, MotifRefus } from "@/types/database";

const STATUS_TRANSITIONS: Record<FicheStatus, { to: FicheStatus[]; roles: UserRole[] }[]> = {
  BROUILLON: [{ to: ["SOUMISE"], roles: ["PROSPECTEUR", "CHEF_EQUIPE", "COMMERCIAL", "ADMIN"] }],
  SOUMISE: [{ to: ["VALIDEE"], roles: ["ADMIN"] }, { to: ["BROUILLON"], roles: ["ADMIN", "PROSPECTEUR", "CHEF_EQUIPE"] }],
  VALIDEE: [{ to: ["AFFECTEE"], roles: ["ADMIN"] }, { to: ["SOUMISE"], roles: ["ADMIN"] }],
  AFFECTEE: [{ to: ["RETRACTATION", "ACCEPTEE", "REFUSEE", "ARCHIVEE", "RDV_A_REPRENDRE"], roles: ["ADMIN", "COMMERCIAL"] }, { to: ["REFUSEE"], roles: ["PROSPECTEUR", "CHEF_EQUIPE"] }, { to: ["SOUMISE"], roles: ["ADMIN"] }],
  RDV_A_REPRENDRE: [{ to: ["AFFECTEE"], roles: ["ADMIN", "PROSPECTEUR", "CHEF_EQUIPE"] }],
  RETRACTATION: [{ to: ["ACCEPTEE", "REFUSEE", "ARCHIVEE"], roles: ["ADMIN", "COMMERCIAL"] }, { to: ["REFUSEE"], roles: ["PROSPECTEUR", "CHEF_EQUIPE"] }, { to: ["AFFECTEE"], roles: ["ADMIN"] }],
  ACCEPTEE: [{ to: ["ARCHIVEE"], roles: ["ADMIN", "COMMERCIAL"] }],
  REFUSEE: [{ to: ["ARCHIVEE"], roles: ["ADMIN", "COMMERCIAL"] }, { to: ["AFFECTEE"], roles: ["ADMIN"] }],
  ARCHIVEE: [],
};

export function canTransition(role: UserRole, from: FicheStatus, to: FicheStatus): boolean {
  return STATUS_TRANSITIONS[from].some((t) => t.to.includes(to) && t.roles.includes(role));
}

export function getAvailableTransitions(role: UserRole, currentStatus: FicheStatus): FicheStatus[] {
  return STATUS_TRANSITIONS[currentStatus].filter((t) => t.roles.includes(role)).flatMap((t) => t.to);
}

export function canManageUsers(role: UserRole): boolean { return role === "ADMIN" || role === "DIRECTION_GENERALE"; }
export function canAssignFiche(role: UserRole): boolean { return role === "ADMIN"; }
export function isDirectionGenerale(role: UserRole): boolean { return role === "DIRECTION_GENERALE"; }

export function canEditFiche(
  role: UserRole,
  userId: string,
  ficheCreatedBy: string,
  ficheAssignedTo: string | null,
  status: FicheStatus,
): boolean {
  if (status === "ARCHIVEE") return false;
  if (role === "DIRECTION_GENERALE") return false;
  if (role === "ADMIN") return true;
  if (role === "COMMERCIAL") return ficheCreatedBy === userId || ficheAssignedTo === userId;
  if (role === "PROSPECTEUR" || role === "CHEF_EQUIPE") {
    if (ficheCreatedBy !== userId) return false;
    return !["ACCEPTEE", "ARCHIVEE"].includes(status);
  }
  return false;
}

export function canEditRdvDate(
  role: UserRole,
  userId: string,
  ficheCreatedBy: string,
  ficheAssignedTo: string | null,
  status: FicheStatus,
): boolean {
  if (status === "ARCHIVEE") return false;
  if (role === "DIRECTION_GENERALE") return false;
  if (role === "ADMIN") return true;
  if (role === "COMMERCIAL") return ficheAssignedTo === userId;
  if (role === "PROSPECTEUR" || role === "CHEF_EQUIPE") return ficheCreatedBy === userId;
  return false;
}

export const STATUS_LABELS: Record<FicheStatus, string> = {
  BROUILLON: "Brouillon", SOUMISE: "À valider", VALIDEE: "Validée", AFFECTEE: "Validée et affectée",
  RDV_A_REPRENDRE: "RDV à reprendre",
  RETRACTATION: "Attente Acceptation Client", ACCEPTEE: "Acceptation Client",
  REFUSEE: "Refus Client", ARCHIVEE: "Archivé",
};

export const STATUS_COLORS: Record<FicheStatus, string> = {
  BROUILLON: "bg-slate-50 text-slate-600 ring-1 ring-slate-200/60",
  SOUMISE: "bg-blue-50 text-blue-700 ring-1 ring-blue-200/60",
  VALIDEE: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60",
  AFFECTEE: "bg-orange-50 text-orange-700 ring-1 ring-orange-200/60",
  RDV_A_REPRENDRE: "bg-amber-50 text-amber-700 ring-1 ring-amber-300/60",
  ACCEPTEE: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60",
  RETRACTATION: "bg-purple-50 text-purple-700 ring-1 ring-purple-200/60",
  REFUSEE: "bg-red-50 text-red-700 ring-1 ring-red-200/60",
  ARCHIVEE: "bg-slate-100 text-slate-500 ring-1 ring-slate-200/60",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  DIRECTION_GENERALE: "Direction Générale", ADMIN: "Direction", COMMERCIAL: "Commercial", PROSPECTEUR: "Référent", CHEF_EQUIPE: "Chef d'équipe",
};

export const MOTIF_REFUS_LABELS: Record<MotifRefus, string> = {
  RDC: "Refus de contrôle (RDC)",
  ANNULATION: "Annulation client",
  REFUS_CLASSIQUE: "Refus classique",
};
