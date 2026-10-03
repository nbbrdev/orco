import { type DisplayStatus, STATUS_LABELS } from "@/features/quotes/status";
import { cn } from "@/lib/utils";

// Selo do status do orçamento, com as cores dos tokens do doc 12 (NBB-87 D1-A; a lista da NBB-48
// usa o mesmo).

const STATUS_CLASSES: Record<DisplayStatus, string> = {
  draft: "bg-status-draft-bg text-status-draft",
  sent: "bg-status-sent-bg text-status-sent",
  approved: "bg-status-approved-bg text-status-approved",
  rejected: "bg-status-rejected-bg text-status-rejected",
  expired: "bg-status-expired-bg text-status-expired",
};

export function StatusBadge({ status }: { status: DisplayStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_CLASSES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
