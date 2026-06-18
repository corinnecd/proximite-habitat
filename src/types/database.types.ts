// Types de la base de données — reflètent le schéma de `supabase/migrations/0001_initial_schema.sql`.
// À terme, régénérer avec : `supabase gen types typescript --project-id <ref> > src/types/database.types.ts`.

export type UserRole = "ADMIN" | "COMMERCIAL" | "PROSPECTEUR" | "CHEF_EQUIPE";
export type FicheStatus =
  | "BROUILLON"
  | "SOUMISE"
  | "VALIDEE"
  | "AFFECTEE"
  | "ACCEPTEE"
  | "RETRACTATION"
  | "REFUSEE"
  | "ARCHIVEE";

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["organizations"]["Insert"]>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          first_name: string;
          last_name: string;
          role: UserRole;
          phone: string | null;
          chef_equipe_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          organization_id: string;
          email: string;
          first_name: string;
          last_name: string;
          role?: UserRole;
          phone?: string | null;
          chef_equipe_id?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
        Relationships: [];
      };
      fiches: {
        Row: {
          id: string;
          organization_id: string;
          reference: string;
          status: FicheStatus;
          created_by: string;
          assigned_to: string | null;
          prospect_nom: string | null;
          prospect_prenom: string | null;
          prospect_adresse: string | null;
          prospect_cp: string | null;
          prospect_ville: string | null;
          prospect_telephone: string | null;
          prospect_email: string | null;
          disponibilites: string[];
          date_visite: string | null;
          heure_visite: string | null;
          annee_construction: number | null;
          annee_emmenagement: number | null;
          temperature_confort: number | null;
          surface_chauffee: number | null;
          nb_habitants: number | null;
          maison_en_vente: boolean | null;
          modes_chauffage: string[];
          systemes_chauffage: string[];
          consommation: string | null;
          cout_annuel: number | null;
          systemes_ventilation: string[];
          age_ventilation: string | null;
          nature_isolant: string[];
          age_isolant: string | null;
          epaisseur_isolant: string | null;
          types_pose_toiture: string[];
          materiaux_toiture: string[];
          departement_code: string | null;
          ville_id: string | null;
          rdv_date: string | null;
          referent_nom: string | null;
          referent_telephone: string | null;
          observations: string | null;
          signature_url: string | null;
          consentement_rgpd: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          reference?: string;
          status?: FicheStatus;
          created_by: string;
          assigned_to?: string | null;
          prospect_nom?: string | null;
          prospect_prenom?: string | null;
          prospect_adresse?: string | null;
          prospect_cp?: string | null;
          prospect_ville?: string | null;
          prospect_telephone?: string | null;
          prospect_email?: string | null;
          disponibilites?: string[];
          date_visite?: string | null;
          heure_visite?: string | null;
          annee_construction?: number | null;
          annee_emmenagement?: number | null;
          temperature_confort?: number | null;
          surface_chauffee?: number | null;
          nb_habitants?: number | null;
          maison_en_vente?: boolean | null;
          modes_chauffage?: string[];
          systemes_chauffage?: string[];
          consommation?: string | null;
          cout_annuel?: number | null;
          systemes_ventilation?: string[];
          age_ventilation?: string | null;
          nature_isolant?: string[];
          age_isolant?: string | null;
          epaisseur_isolant?: string | null;
          types_pose_toiture?: string[];
          materiaux_toiture?: string[];
          departement_code?: string | null;
          ville_id?: string | null;
          rdv_date?: string | null;
          referent_nom?: string | null;
          referent_telephone?: string | null;
          observations?: string | null;
          signature_url?: string | null;
          consentement_rgpd?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["fiches"]["Insert"]>;
        Relationships: [];
      };
      fiche_history: {
        Row: {
          id: string;
          fiche_id: string;
          organization_id: string;
          user_id: string | null;
          action: string;
          old_status: FicheStatus | null;
          new_status: FicheStatus | null;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          fiche_id: string;
          organization_id: string;
          user_id?: string | null;
          action: string;
          old_status?: FicheStatus | null;
          new_status?: FicheStatus | null;
          comment?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["fiche_history"]["Insert"]>;
        Relationships: [];
      };
      fiche_photos: {
        Row: {
          id: string;
          fiche_id: string;
          organization_id: string;
          storage_path: string;
          original_name: string | null;
          size: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          fiche_id: string;
          organization_id: string;
          storage_path: string;
          original_name?: string | null;
          size?: number | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["fiche_photos"]["Insert"]>;
        Relationships: [];
      };
      zones_departements: {
        Row: {
          code: string;
          nom: string;
          region: string;
        };
        Insert: {
          code: string;
          nom: string;
          region: string;
        };
        Update: Partial<Database["public"]["Tables"]["zones_departements"]["Insert"]>;
        Relationships: [];
      };
      zones_villes: {
        Row: {
          id: string;
          departement_code: string;
          nom: string;
          code_postal: string;
          lat: number;
          lng: number;
        };
        Insert: {
          id?: string;
          departement_code: string;
          nom: string;
          code_postal: string;
          lat?: number;
          lng?: number;
        };
        Update: Partial<Database["public"]["Tables"]["zones_villes"]["Insert"]>;
        Relationships: [];
      };
      planification_hebdo: {
        Row: {
          id: string;
          organization_id: string;
          semaine_du: string;
          ville_id: string;
          chef_equipe_id: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          semaine_du: string;
          ville_id: string;
          chef_equipe_id?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["planification_hebdo"]["Insert"]>;
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string;
          type: string;
          title: string;
          message: string | null;
          fiche_id: string | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          organization_id: string;
          type: string;
          title: string;
          message?: string | null;
          fiche_id?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      transition_fiche: {
        Args: {
          p_fiche_id: string;
          p_new_status: FicheStatus;
          p_comment?: string | null;
          p_assigned_to?: string | null;
        };
        Returns: Database["public"]["Tables"]["fiches"]["Row"];
      };
    };
    Enums: {
      user_role: UserRole;
      fiche_status: FicheStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
}

// ── Raccourcis pratiques ──────────────────────────────────────────────────────
type Tables = Database["public"]["Tables"];

export type Organization = Tables["organizations"]["Row"];
export type Profile = Tables["profiles"]["Row"];
export type Fiche = Tables["fiches"]["Row"];
export type FicheHistory = Tables["fiche_history"]["Row"];
export type FichePhoto = Tables["fiche_photos"]["Row"];
export type Notification = Tables["notifications"]["Row"];
export type ZoneDepartement = Tables["zones_departements"]["Row"];
export type ZoneVille = Tables["zones_villes"]["Row"];
export type PlanificationHebdo = Tables["planification_hebdo"]["Row"];
