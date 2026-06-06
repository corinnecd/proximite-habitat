import { z } from "zod";

export const step1Schema = z.object({
  prospect_nom: z.string().min(1, "Le nom est requis"),
  prospect_prenom: z.string().min(1, "Le prénom est requis"),
  prospect_adresse: z.string().min(1, "L'adresse est requise"),
  prospect_cp: z.string().regex(/^\d{5}$/, "Code postal invalide (5 chiffres)"),
  prospect_ville: z.string().min(1, "La ville est requise"),
  prospect_telephone: z.string().regex(/^(?:(?:\+33|0)\s?[1-9])(?:[\s.-]?\d{2}){4}$/, "Numéro de téléphone invalide"),
  disponibilites: z.array(z.string()),
  date_visite: z.string().nullable().optional(),
  heure_visite: z.string().nullable().optional(),
});

export const step2Schema = z.object({
  annee_construction: z.coerce.number().min(1800).max(2030).nullable().optional(),
  annee_emmenagement: z.coerce.number().min(1800).max(2030).nullable().optional(),
  temperature_confort: z.coerce.number().min(10).max(35).nullable().optional(),
  surface_chauffee: z.coerce.number().min(1).max(10000).nullable().optional(),
  nb_habitants: z.coerce.number().min(1).max(8).nullable().optional(),
  maison_en_vente: z.boolean().nullable().optional(),
});

export const step3Schema = z.object({
  modes_chauffage: z.array(z.string()),
  systemes_chauffage: z.array(z.string()),
  consommation: z.string().nullable().optional(),
  cout_annuel: z.coerce.number().min(0).nullable().optional(),
});

export const step4Schema = z.object({
  systemes_ventilation: z.array(z.string()),
  age_ventilation: z.string().nullable().optional(),
});

export const step5Schema = z.object({
  nature_isolant: z.array(z.string()),
  age_isolant: z.string().nullable().optional(),
  epaisseur_isolant: z.string().nullable().optional(),
  types_pose_toiture: z.array(z.string()),
  materiaux_toiture: z.array(z.string()),
});

export const step6Schema = z.object({ observations: z.string().nullable().optional() });

export const step7Schema = z.object({
  consentement_rgpd: z.literal(true, { error: "Le consentement RGPD est obligatoire" }),
});

export const ficheSchema = step1Schema.merge(step2Schema).merge(step3Schema).merge(step4Schema).merge(step5Schema).merge(step6Schema).merge(step7Schema);
export type FicheFormData = z.infer<typeof ficheSchema>;

export const JOURS_DISPONIBILITES = ["LU", "MA", "ME", "JE", "VE", "SA"] as const;
export const MODES_CHAUFFAGE = ["Électricité", "Gaz", "Fioul", "Bois"] as const;
export const SYSTEMES_CHAUFFAGE = ["Chaudière", "Radiateur", "Cheminée", "Poêle", "Pompe à chaleur", "Autre"] as const;
export const SYSTEMES_VENTILATION = ["VMC Simple Flux", "VMC Double Flux", "VPH", "VMI", "Aération Naturelle"] as const;
export const NATURE_ISOLANT = ["Laine de verre", "Laine de roche", "Thermoréflexion", "Ouate de cellulose", "Polystirène"] as const;
export const TYPES_POSE_TOITURE = ["Sous tuiles", "Au solivages", "Combles perdus", "Trappes", "Non accessible", "Plancher", "Écran sous toiture"] as const;
export const MATERIAUX_TOITURE = ["Terre cuite mécanique", "Terre cuite plate", "Béton", "Ardoise", "Shingle", "Autre"] as const;
