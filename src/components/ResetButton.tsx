"use client";
import { useAction } from "./useAction";

export default function ResetButton() {
  const { run, busy } = useAction();
  return (
    <button
      className="text-xs text-subtle hover:text-muted"
      disabled={busy}
      onClick={() => confirm("Reset all demo data?") && run("/api/reset")}
    >
      {busy ? "Resetting…" : "Reset demo data"}
    </button>
  );
}
