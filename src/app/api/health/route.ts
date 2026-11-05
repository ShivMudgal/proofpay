import { NextResponse } from "next/server";
import { paypalLive } from "@/lib/paypal";
import { aiLive } from "@/lib/llm";

export function GET() {
  return NextResponse.json({ ok: true, paypal: paypalLive ? "sandbox" : "local", ai: aiLive ? "gemini" : "rules" });
}
