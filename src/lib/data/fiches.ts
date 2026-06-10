import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Fiche, FicheStatus } from "@/types/database";

type Db = SupabaseClient<Database>;

/** Colonnes communes pour l'affichage en liste (dashboard, /fiches, reporting). */
export const FICHE_LIST_COLUMNS =
  "id, reference, status, prospect_nom, prospect_prenom, prospect_ville, created_at, created_by, updated_at";

export type FicheListItem = Pick<
  Fiche,
  | "id"
  | "reference"
  | "status"
  | "prospect_nom"
  | "prospect_prenom"
  | "prospect_ville"
  | "created_at"
  | "created_by"
  | "updated_at"
>;

/** Entrée d'historique enrichie du profil de l'auteur (jointure `profiles`). */
export type FicheHistoryEntry = {
  id: string;
  action: string;
  old_status: FicheStatus | null;
  new_status: FicheStatus | null;
  comment: string | null;
  created_at: string;
  profiles: { first_name: string; last_name: string } | null;
};

export type FichePhotoItem = {
  id: string;
  storage_path: string;
  original_name: string | null;
};

/** Une fiche complète par son id, ou `null` si introuvable. */
export async function getFicheById(db: Db, id: string): Promise<Fiche | null> {
  const { data } = await db.from("fiches").select("*").eq("id", id).single();
  return data;
}

/** Les photos rattachées à une fiche. */
export async function getFichePhotos(db: Db, ficheId: string): Promise<FichePhotoItem[]> {
  const { data } = await db
    .from("fiche_photos")
    .select("id, storage_path, original_name")
    .eq("fiche_id", ficheId);
  return data ?? [];
}

/** L'historique d'une fiche (du plus récent au plus ancien), avec l'auteur. */
export async function getFicheHistory(db: Db, ficheId: string): Promise<FicheHistoryEntry[]> {
  const { data } = await db
    .from("fiche_history")
    .select("*, profiles(first_name, last_name)")
    .eq("fiche_id", ficheId)
    .order("created_at", { ascending: false });
  return (data as unknown as FicheHistoryEntry[]) ?? [];
}

/** Compte les fiches d'un statut donné, éventuellement restreint à un créateur. */
export async function countFichesByStatus(
  db: Db,
  status: FicheStatus,
  opts?: { createdBy?: string },
): Promise<number> {
  let query = db.from("fiches").select("*", { count: "exact", head: true }).eq("status", status);
  if (opts?.createdBy) query = query.eq("created_by", opts.createdBy);
  const { count } = await query;
  return count ?? 0;
}

/**
 * Supprime une fiche et toutes ses dépendances dans l'ordre :
 * photos du storage → `fiche_photos` → `fiche_history` → `notifications` → `fiches`.
 * Lève en cas d'échec de la suppression finale de la fiche.
 */
export async function deleteFicheCascade(db: Db, ficheId: string): Promise<void> {
  const { data: photos } = await db
    .from("fiche_photos")
    .select("storage_path")
    .eq("fiche_id", ficheId);
  if (photos && photos.length > 0) {
    await db.storage.from("photos").remove(photos.map((p) => p.storage_path));
    await db.from("fiche_photos").delete().eq("fiche_id", ficheId);
  }
  await db.from("fiche_history").delete().eq("fiche_id", ficheId);
  await db.from("notifications").delete().eq("fiche_id", ficheId);
  const { error } = await db.from("fiches").delete().eq("id", ficheId);
  if (error) throw error;
}

/** Ligne complète destinée à l'export CSV de la liste des fiches. */
export type FicheExportRow = {
  reference: string;
  status: FicheStatus;
  prospect_nom: string;
  prospect_prenom: string;
  prospect_adresse: string | null;
  prospect_cp: string | null;
  prospect_ville: string | null;
  prospect_telephone: string | null;
  date_visite: string | null;
  heure_visite: string | null;
  created_at: string;
  updated_at: string;
  assigned_to_profile: { first_name: string; last_name: string } | null;
};

/**
 * Toutes les fiches correspondant aux filtres courants (sans pagination),
 * pour l'export CSV. Reproduit la logique de visibilité de la page liste.
 */
export async function getFichesForExport(
  db: Db,
  opts: { statusFilter: FicheStatus | "ALL"; isProspecteur: boolean; createdBy?: string; search?: string },
): Promise<FicheExportRow[]> {
  let query = db
    .from("fiches")
    .select(
      "reference, status, prospect_nom, prospect_prenom, prospect_adresse, prospect_cp, prospect_ville, prospect_telephone, date_visite, heure_visite, created_at, updated_at, assigned_to_profile:profiles!fiches_assigned_to_fkey(first_name, last_name)",
    )
    .order("updated_at", { ascending: false });

  if (opts.statusFilter !== "ALL") {
    query = query.eq("status", opts.statusFilter);
  } else if (!opts.isProspecteur) {
    query = query.neq("status", "BROUILLON");
  }
  if (opts.isProspecteur && opts.createdBy) {
    query = query.eq("created_by", opts.createdBy);
  }
  if (opts.search) {
    query = query.or(
      `prospect_nom.ilike.%${opts.search}%,prospect_prenom.ilike.%${opts.search}%,reference.ilike.%${opts.search}%,prospect_ville.ilike.%${opts.search}%`,
    );
  }

  const { data } = await query;
  return (data as unknown as FicheExportRow[]) ?? [];
}

export type DuplicateFiche = {
  id: string;
  reference: string;
  status: FicheStatus;
  prospect_nom: string;
  prospect_prenom: string;
  prospect_ville: string | null;
  created_at: string;
};

/**
 * Recherche les fiches susceptibles d'être des doublons du prospect en cours de saisie :
 * même téléphone, OU même nom + même code postal. Exclut la fiche courante (`excludeId`).
 * Limité aux fiches visibles par l'utilisateur (RLS) et aux 5 plus récentes.
 */
export async function findDuplicateFiches(
  db: Db,
  opts: { nom?: string; cp?: string; telephone?: string; excludeId?: string },
): Promise<DuplicateFiche[]> {
  const nom = opts.nom?.trim();
  const cp = opts.cp?.trim();
  const tel = opts.telephone?.trim();

  const conditions: string[] = [];
  if (tel && tel.replace(/\s+/g, "").length >= 6) conditions.push(`prospect_telephone.eq.${tel}`);
  if (nom && cp) conditions.push(`and(prospect_nom.ilike.${nom},prospect_cp.eq.${cp})`);
  if (conditions.length === 0) return [];

  let query = db
    .from("fiches")
    .select("id, reference, status, prospect_nom, prospect_prenom, prospect_ville, created_at")
    .or(conditions.join(","))
    .order("created_at", { ascending: false })
    .limit(5);
  if (opts.excludeId) query = query.neq("id", opts.excludeId);

  const { data } = await query;
  return (data as DuplicateFiche[]) ?? [];
}

/**
 * Données minimales (date de création + statut) de toutes les fiches visibles,
 * pour l'agrégation de statistiques côté client. Une seule requête.
 */
export async function getFichesForStats(
  db: Db,
  opts?: { from?: string; assignedTo?: string },
): Promise<{ created_at: string; status: FicheStatus }[]> {
  let query = db.from("fiches").select("created_at, status");
  if (opts?.from) query = query.gte("created_at", opts.from);
  if (opts?.assignedTo) query = query.eq("assigned_to", opts.assignedTo);
  const { data } = await query;
  return (data as { created_at: string; status: FicheStatus }[]) ?? [];
}

/** Les commerciaux et admins actifs (pour l'affectation d'une fiche). */
export async function getActiveCommercialsAndAdmins(db: Db) {
  const { data } = await db
    .from("profiles")
    .select("id, first_name, last_name, role")
    .in("role", ["COMMERCIAL", "ADMIN"])
    .eq("is_active", true);
  return data ?? [];
}
