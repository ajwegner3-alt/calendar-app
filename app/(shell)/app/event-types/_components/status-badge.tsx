import { Badge } from "@/components/ui/badge";

export function StatusBadge({
  isActive,
  deletedAt,
}: {
  isActive: boolean;
  deletedAt: string | null;
}) {
  if (deletedAt) return <Badge variant="outline">Archived</Badge>;
  if (!isActive) return <Badge variant="secondary">Inactive</Badge>;
  return <Badge>Active</Badge>;
}
