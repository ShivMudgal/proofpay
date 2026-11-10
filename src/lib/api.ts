import { NextResponse } from "next/server";
import { HttpError } from "./errors";
import { PayPalError } from "./paypal";

export type RouteContext = { params: Promise<{ id: string }> };

/** Runs a route handler and always answers with JSON: the result, or { error } with a fitting status. */
export async function respond(handler: () => Promise<unknown>) {
  try {
    return NextResponse.json((await handler()) ?? { ok: true });
  } catch (err) {
    const { status, message } = describeError(err);
    if (status >= 500) console.error(err);
    return NextResponse.json({ error: message }, { status });
  }
}

export function describeError(err: unknown): { status: number; message: string } {
  if (err instanceof HttpError) return { status: err.status, message: err.message };

  // A malformed request body (await req.json() on bad input).
  if (err instanceof SyntaxError) return { status: 400, message: "The request body isn't valid JSON." };

  if (err instanceof PayPalError) {
    if (err.status === 401) {
      return { status: 502, message: "PayPal rejected the app's credentials. Check PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET." };
    }
    if (err.status === 422 || err.status === 400) {
      return { status: 422, message: `PayPal couldn't complete this step${err.issue ? ` (${err.issue})` : ""}. Please try again.` };
    }
    return { status: 502, message: "PayPal is not responding right now. Please try again in a moment." };
  }

  const name = err instanceof Error ? err.name : "";
  if (name === "TimeoutError" || name === "AbortError") {
    return { status: 504, message: "An outside service took too long to respond. Please try again." };
  }
  if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ECONNRESET|connection terminated/i.test(String(err))) {
    return { status: 503, message: "The database or an outside service is unreachable. Please try again in a moment." };
  }
  return { status: 500, message: "Something went wrong on our side. Please try again." };
}
