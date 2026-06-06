import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, STATUS_COLORS } from "@/lib/permissions";
import type { FicheStatus } from "@/types/database";

export function FicheStatusBadge({ status }: { status: FicheStatus }) {
  return <Badge variant="secondary" className={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Badge>;
}
