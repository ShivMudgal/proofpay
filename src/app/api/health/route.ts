import { NextResponse } from "next/server";
import { paypalLive } from "@/lib/paypal";
import { aiLive } from "@/lib/llm";
import { dbBackend, read } from "@/lib/db";

export async function GET() {
  const status = { paypal: paypalLive ? "sandbox" : "local", ai: aiLive ? "gemini" : "rules", db: dbBackend };
  try {
    await read();
    return NextResponse.json({ ok: true, ...status });
  } catch {
    return NextResponse.json({ ok: false, ...status, error: "database unreachable" }, { status: 503 });
  }
}
