import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/permissions";
import type { FicheStatus } from "@/types/database";

// Labels courts pour les espaces contraints (cartes dashboard mobile, etc.)
const STATUS_LABELS_SHORT: Record<FicheStatus, string> = {
  BROUILLON: "Brouillon",
  SOUMISE: "À valider",
  VALIDEE: "Validée",
  AFFECTEE: "Affectée",
  RDV_A_REPRENDRE: "RDV à reprendre",
  RETRACTATION: "Attente client",
  ACCEPTEE: "Acceptée",
  REFUSEE: "Refusée",
  ARCHIVEE: "Archivé",
};

export function FicheStatusBadge({ status, short = false }: { status: FicheStatus; short?: boolean }) {
  const label = short ? STATUS_LABELS_SHORT[status] : STATUS_LABELS[status];
  return <Badge variant="secondary" className={STATUS_COLORS[status]}>{label}</Badge>;
}
