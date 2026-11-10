import type { MilestoneStatus } from "@/lib/types";

const STYLES: Record<MilestoneStatus, { label: string; dot: string; cls: string }> = {
  PENDING: { label: "Unfunded", dot: "bg-gray-400", cls: "text-gray-700 bg-gray-50 ring-gray-200" },
  FUNDED: { label: "In escrow", dot: "bg-amber-500", cls: "text-amber-800 bg-amber-50 ring-amber-200" },
  SUBMITTED: { label: "In review", dot: "bg-indigo-500", cls: "text-indigo-800 bg-indigo-50 ring-indigo-200" },
  REJECTED: { label: "Changes requested", dot: "bg-red-500", cls: "text-red-800 bg-red-50 ring-red-200" },
  RELEASED: { label: "Paid", dot: "bg-emerald-500", cls: "text-emerald-800 bg-emerald-50 ring-emerald-200" },
  VOIDED: { label: "Cancelled", dot: "bg-gray-300", cls: "text-gray-500 bg-gray-50 ring-gray-200" },
};

export function statusLabel(s: MilestoneStatus) {
  return STYLES[s].label;
}

export default function StatusBadge({ status }: { status: MilestoneStatus }) {
  const s = STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

const DEAL: Record<string, { label: string; cls: string }> = {
  NEGOTIATING: { label: "Negotiating", cls: "text-indigo-800 bg-indigo-50 ring-indigo-200" },
  AGREED: { label: "Agreed", cls: "text-amber-800 bg-amber-50 ring-amber-200" },
  CONTRACTED: { label: "Active contract", cls: "text-sky-800 bg-sky-50 ring-sky-200" },
  COMPLETED: { label: "Completed", cls: "text-emerald-800 bg-emerald-50 ring-emerald-200" },
};

export function DealBadge({ status }: { status: string }) {
  const s = DEAL[status];
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s.cls}`}>{s.label}</span>;
}
