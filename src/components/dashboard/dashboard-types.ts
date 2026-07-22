// ── Types partagés entre le dashboard et ses sous-composants ──────────────────

export interface HistoryEntry {
  action: string;
  old_status: string | null;
  new_status: string | null;
  comment: string | null;
  created_at: string;
  user: { first_name: string; last_name: string } | null;
}

export interface FicheAffectee {
  id: string;
  reference: string;
  prospect_nom: string;
  prospect_prenom: string;
  prospect_ville: string | null;
  prospect_cp: string | null;
  updated_at: string;
  created_at: string;
  created_by: string;
  montant_ht: number | null;
  created_by_profile: { first_name: string; last_name: string } | null;
  fiche_history: HistoryEntry[];
}

export interface ReferentStat {
  id: string;
  nom: string;
  ventes: number;        // total ventes
  ventesMoisCourant: number; // ventes ce mois-ci
  primes: number;        // mois avec ≥3 ventes
  prochainPalier: number; // ventes restantes ce mois avant la prime
  ca: number;            // CA HT total
}

export interface CommercialStat {
  id: string;
  nom: string;
  ventes: number;
  ca: number;
}
