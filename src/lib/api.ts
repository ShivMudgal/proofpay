import { NextResponse } from "next/server";
import { HttpError } from "./errors";

export type RouteContext = { params: Promise<{ id: string }> };

export async function respond(handler: () => Promise<unknown>) {
  try {
    return NextResponse.json((await handler()) ?? { ok: true });
  } catch (err) {
    if (err instanceof HttpError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
