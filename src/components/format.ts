import { formatINR } from "@/lib/money";

export const inr = (n: number) => formatINR(n, !Number.isInteger(n));

// Always show India time (IST). Without this, the server renders in its own zone (UTC on Render)
// and the browser re-renders in the viewer's zone, so the same event could show two different times.
const TIME_ZONE = "Asia/Kolkata";

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: TIME_ZONE });

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
