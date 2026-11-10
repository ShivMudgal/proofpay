import { NextResponse } from "next/server";
import { read } from "@/lib/db";

export async function POST(req: Request) {
  const { userId } = await req.json();
  if (!(await read()).users.some((u) => u.id === userId)) return NextResponse.json({ error: "Unknown user" }, { status: 400 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set("pp_user", userId, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
