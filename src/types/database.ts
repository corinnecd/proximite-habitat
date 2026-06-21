// Point d'entrée des types DB. Les définitions vivent dans `database.types.ts`
// (alignées sur les migrations SQL) ; ce fichier les ré-expose pour conserver
// les imports historiques `@/types/database`.
export type {
  Database,
  UserRole,
  FicheStatus,
  MotifRefus,
  Organization,
  Profile,
  Fiche,
  FicheHistory,
  FichePhoto,
  Notification,
  ZoneDepartement,
  ZoneVille,
  PlanificationHebdo,
} from "./database.types";
