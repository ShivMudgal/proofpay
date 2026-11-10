import { NextResponse } from "next/server";
import { respond } from "@/lib/api";
import { read } from "@/lib/db";
import { badRequest } from "@/lib/errors";

export async function POST(req: Request) {
  let userId: unknown;
  const failure = await respond(async () => {
    ({ userId } = await req.json());
    if (typeof userId !== "string" || !(await read()).users.some((u) => u.id === userId)) throw badRequest("Unknown user");
  });
  if (!failure.ok) return failure;

  const res = NextResponse.json({ ok: true });
  res.cookies.set("pp_user", userId as string, { path: "/", httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
  return res;
}
