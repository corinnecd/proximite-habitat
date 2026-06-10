// Re-export depuis le ProfileContext — une seule requête DB par session.
export { useProfile } from "@/lib/context/profile-context";
export type { Profile } from "@/types/database";
