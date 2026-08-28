import type { UserRole, FicheStatus, MotifRefus } from "@/types/database";

const STATUS_TRANSITIONS: Record<FicheStatus, { to: FicheStatus[]; roles: UserRole[] }[]> = {
  BROUILLON: [{ to: ["SOUMISE"], roles: ["PROSPECTEUR", "CHEF_EQUIPE", "COMMERCIAL", "DIRECTION"] }],
  SOUMISE: [{ to: ["VALIDEE"], roles: ["DIRECTION"] }, { to: ["BROUILLON"], roles: ["DIRECTION", "PROSPECTEUR", "CHEF_EQUIPE"] }],
  VALIDEE: [{ to: ["AFFECTEE"], roles: ["DIRECTION"] }, { to: ["SOUMISE"], roles: ["DIRECTION"] }],
  AFFECTEE: [{ to: ["RETRACTATION", "ACCEPTEE", "REFUSEE", "ARCHIVEE", "RDV_A_REPRENDRE"], roles: ["DIRECTION", "COMMERCIAL"] }, { to: ["REFUSEE"], roles: ["PROSPECTEUR", "CHEF_EQUIPE"] }, { to: ["SOUMISE"], roles: ["DIRECTION"] }],
  RDV_A_REPRENDRE: [{ to: ["AFFECTEE"], roles: ["DIRECTION", "PROSPECTEUR", "CHEF_EQUIPE"] }],
  RETRACTATION: [{ to: ["ACCEPTEE", "REFUSEE", "ARCHIVEE"], roles: ["DIRECTION", "COMMERCIAL"] }, { to: ["REFUSEE"], roles: ["PROSPECTEUR", "CHEF_EQUIPE"] }, { to: ["AFFECTEE"], roles: ["DIRECTION"] }],
  ACCEPTEE: [{ to: ["RDV_TECHNICIEN", "ARCHIVEE"], roles: ["DIRECTION", "COMMERCIAL"] }],
  RDV_TECHNICIEN: [{ to: ["INSTALLEE", "REFUSEE", "RETRACTATION", "ARCHIVEE"], roles: ["DIRECTION", "COMMERCIAL"] }],
  INSTALLEE: [{ to: ["ARCHIVEE", "RDV_TECHNICIEN"], roles: ["DIRECTION", "COMMERCIAL"] }],
  REFUSEE: [{ to: ["ARCHIVEE"], roles: ["DIRECTION", "COMMERCIAL"] }, { to: ["AFFECTEE"], roles: ["DIRECTION"] }],
  ARCHIVEE: [],
};

export function canTransition(role: UserRole, from: FicheStatus, to: FicheStatus): boolean {
  return STATUS_TRANSITIONS[from].some((t) => t.to.includes(to) && t.roles.includes(role));
}

export function getAvailableTransitions(role: UserRole, currentStatus: FicheStatus): FicheStatus[] {
  return STATUS_TRANSITIONS[currentStatus].filter((t) => t.roles.includes(role)).flatMap((t) => t.to);
}

export function canManageUsers(role: UserRole): boolean { return role === "SUPER_ADMIN"; }
export function canAssignFiche(role: UserRole): boolean { return role === "DIRECTION"; }
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
  if (role === "DIRECTION" || role === "SUPER_ADMIN") return true;
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
  if (["ACCEPTEE", "RDV_TECHNICIEN", "INSTALLEE", "ARCHIVEE"].includes(status)) return false;
  if (role === "DIRECTION_GENERALE") return false;
  if (role === "DIRECTION" || role === "SUPER_ADMIN") return true;
  if (role === "COMMERCIAL") return ficheAssignedTo === userId;
  if (role === "PROSPECTEUR" || role === "CHEF_EQUIPE") return ficheCreatedBy === userId;
  return false;
}

export const STATUS_LABELS: Record<FicheStatus, string> = {
  BROUILLON: "Brouillon", SOUMISE: "À valider", VALIDEE: "Validée", AFFECTEE: "Validée et affectée",
  RDV_A_REPRENDRE: "RDV à reprendre",
  RETRACTATION: "Attente Acceptation Client", ACCEPTEE: "Acceptation Client",
  RDV_TECHNICIEN: "RDV Technicien", INSTALLEE: "Installée",
  REFUSEE: "Refus Client", ARCHIVEE: "Archivé",
};

export const STATUS_COLORS: Record<FicheStatus, string> = {
  BROUILLON: "bg-slate-50 text-slate-600 ring-1 ring-slate-200/60",
  SOUMISE: "bg-blue-50 text-blue-700 ring-1 ring-blue-200/60",
  VALIDEE: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60",
  AFFECTEE: "bg-orange-50 text-orange-700 ring-1 ring-orange-200/60",
  RDV_A_REPRENDRE: "bg-[#F97316] text-white font-semibold",
  ACCEPTEE: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60",
  RETRACTATION: "bg-purple-50 text-purple-700 ring-1 ring-purple-200/60",
  RDV_TECHNICIEN: "bg-violet-50 text-violet-700 ring-1 ring-violet-200/60",
  INSTALLEE: "bg-teal-50 text-teal-700 ring-1 ring-teal-200/60",
  REFUSEE: "bg-red-50 text-red-700 ring-1 ring-red-200/60",
  ARCHIVEE: "bg-slate-100 text-slate-500 ring-1 ring-slate-200/60",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: "Super Admin", DIRECTION_GENERALE: "Direction Générale", DIRECTION: "Direction", COMMERCIAL: "Commercial", PROSPECTEUR: "Référent", CHEF_EQUIPE: "Chef d'équipe",
};

export const MOTIF_REFUS_LABELS: Record<MotifRefus, string> = {
  RDC: "Refus de contrôle (RDC)",
  ANNULATION: "Annulation client",
  REFUS_CLASSIQUE: "Refus classique",
};

/**
 * Qui peut tracer, modifier ou supprimer un parcours hebdomadaire.
 *
 * Le chef d'équipe n'est pas un profil dédié : il est nommé pour la semaine via
 * `planification_hebdo.chef_equipe_id` et peut être un référent, un commercial
 * ou un membre de la direction. L'édition du parcours est donc ouverte à ces
 * trois profils. `DIRECTION_GENERALE` en est exclu : ce rôle est en lecture seule.
 */
export function canEditParcours(role: UserRole | undefined | null): boolean {
  if (!role) return false;
  return (["PROSPECTEUR", "COMMERCIAL", "DIRECTION", "CHEF_EQUIPE", "SUPER_ADMIN"] as UserRole[])
    .includes(role);
}

export const MOTIF_ARCHIVAGE_LABELS: Record<string, string> = {
  DOSSIER_INCOMPLET: "Dossier incomplet",
  INJOIGNABLE: "Client injoignable",
  HORS_ZONE: "Hors zone d'intervention",
  DOUBLON: "Doublon",
  SANS_SUITE: "Sans suite",
  AUTRE: "Autre raison",
};
