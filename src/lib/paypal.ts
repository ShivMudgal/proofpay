// PayPal Orders v2 with intent=AUTHORIZE.
// authorize -> funds held, capture -> paid to payee, void -> hold released.
// Without credentials every call returns a fake id so the app still runs locally.
import crypto from "node:crypto";

const BASE_URL = process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID || "";
const CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || "";

export const paypalLive = Boolean(CLIENT_ID && CLIENT_SECRET);

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;

  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw PayPalError.from("POST", "/v1/oauth2/token", res.status, await res.text());

  const { access_token, expires_in } = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { value: access_token, expiresAt: Date.now() + expires_in * 1000 };
  return access_token;
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await getAccessToken()}`,
      "Content-Type": "application/json",
      "PayPal-Request-Id": crypto.randomUUID(),
      Prefer: "return=representation",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  if (!res.ok) throw PayPalError.from(method, path, res.status, text);
  return (text ? JSON.parse(text) : {}) as T;
}

/** A failed PayPal API call, with PayPal's error name and first issue code when it sent them. */
export class PayPalError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly issue: string | null,
    public readonly debugId: string | null,
  ) {
    super(message);
    this.name = "PayPalError";
  }

  static from(method: string, path: string, status: number, body: string) {
    let issue: string | null = null;
    let debugId: string | null = null;
    try {
      const j = JSON.parse(body) as { name?: string; error?: string; debug_id?: string; details?: { issue?: string }[] };
      issue = j.details?.[0]?.issue ?? j.name ?? j.error ?? null;
      debugId = j.debug_id ?? null;
    } catch {
      // Not JSON; keep the raw text in the message.
    }
    return new PayPalError(`PayPal ${method} ${path} failed (${status}${issue ? ` ${issue}` : ""}): ${body.slice(0, 300)}`, status, issue, debugId);
  }
}

/**
 * True when PayPal says the authorization no longer holds money: it expired, was voided,
 * or doesn't exist. An already-captured authorization is NOT treated as gone.
 */
export function isHoldGone(err: unknown) {
  if (!(err instanceof PayPalError)) return false;
  const issue = (err.issue ?? "").toUpperCase();
  if (issue.includes("ALREADY_CAPTURED")) return false;
  return err.status === 404 || /EXPIRED|VOIDED|INVALID_RESOURCE_ID|RESOURCE_NOT_FOUND|AUTHORIZATION_DENIED/.test(issue);
}

const fakeId = (prefix: string) => `${prefix}-LOCAL-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

// The seed's placeholder emails aren't real sandbox accounts, so skip the payee for them.
// Real sandbox accounts also end in example.com (e.g. sb-xxx@business.example.com), so match exactly.
const PLACEHOLDER_EMAILS = new Set(["freelancer@business.example.com", "client@personal.example.com"]);
const canReceive = (email?: string) => !!email && !PLACEHOLDER_EMAILS.has(email.toLowerCase());

export async function createOrder(input: {
  referenceId: string;
  description: string;
  amount: { currency: string; value: string };
  payeeEmail?: string;
}) {
  if (!paypalLive) return { orderId: fakeId("ORDER") };

  const order = await request<{ id: string }>("POST", "/v2/checkout/orders", {
    intent: "AUTHORIZE",
    purchase_units: [
      {
        reference_id: input.referenceId,
        custom_id: input.referenceId,
        description: input.description.slice(0, 127),
        amount: { currency_code: input.amount.currency, value: input.amount.value },
        ...(canReceive(input.payeeEmail) && { payee: { email_address: input.payeeEmail } }),
      },
    ],
    payment_source: {
      paypal: {
        experience_context: { brand_name: "ProofPay", user_action: "CONTINUE", shipping_preference: "NO_SHIPPING" },
      },
    },
  });
  return { orderId: order.id };
}

type AuthorizeResponse = {
  purchase_units?: { payments?: { authorizations?: { id: string; expiration_time?: string }[] } }[];
};

export async function authorizeOrder(orderId: string) {
  if (!paypalLive) return { authorizationId: fakeId("AUTH"), expiresAt: undefined };

  const res = await request<AuthorizeResponse>("POST", `/v2/checkout/orders/${orderId}/authorize`, {});
  const auth = res.purchase_units?.[0]?.payments?.authorizations?.[0];
  if (!auth) throw new Error("PayPal did not return an authorization");
  return { authorizationId: auth.id, expiresAt: auth.expiration_time };
}

// Local mode only: an authorization ID containing "EXPIRED" behaves like an expired PayPal hold,
// so the recovery path can be tried without waiting 3+ days in the sandbox.
const simulatedExpiry = () =>
  new PayPalError("Simulated expired authorization", 422, "AUTHORIZATION_EXPIRED", null);

export async function captureAuthorization(authorizationId: string, note: string) {
  if (!paypalLive) {
    if (authorizationId.includes("EXPIRED")) throw simulatedExpiry();
    return { captureId: fakeId("CAPTURE") };
  }

  const res = await request<{ id: string }>("POST", `/v2/payments/authorizations/${authorizationId}/capture`, {
    final_capture: true,
    note_to_payer: note.slice(0, 255),
  });
  return { captureId: res.id };
}

export async function voidAuthorization(authorizationId: string) {
  if (!paypalLive) {
    if (authorizationId.includes("EXPIRED")) throw simulatedExpiry();
    return;
  }
  await request("POST", `/v2/payments/authorizations/${authorizationId}/void`);
}

export async function verifyWebhookSignature(headers: Headers, rawBody: string) {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!paypalLive) return true;
  if (!webhookId) return false;

  const res = await request<{ verification_status: string }>("POST", "/v1/notifications/verify-webhook-signature", {
    auth_algo: headers.get("paypal-auth-algo"),
    cert_url: headers.get("paypal-cert-url"),
    transmission_id: headers.get("paypal-transmission-id"),
    transmission_sig: headers.get("paypal-transmission-sig"),
    transmission_time: headers.get("paypal-transmission-time"),
    webhook_id: webhookId,
    webhook_event: JSON.parse(rawBody),
  });
  return res.verification_status === "SUCCESS";
}
