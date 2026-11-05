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
  });
  if (!res.ok) throw new Error(`PayPal auth failed (${res.status}): ${await res.text()}`);

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
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`PayPal ${method} ${path} failed (${res.status}): ${text}`);
  return (text ? JSON.parse(text) : {}) as T;
}

const fakeId = (prefix: string) => `${prefix}-LOCAL-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

// Placeholder seed emails can't receive sandbox payments, so skip the payee for them.
const canReceive = (email?: string) => !!email && !email.endsWith("example.com");

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

export async function captureAuthorization(authorizationId: string, note: string) {
  if (!paypalLive) return { captureId: fakeId("CAPTURE") };

  const res = await request<{ id: string }>("POST", `/v2/payments/authorizations/${authorizationId}/capture`, {
    final_capture: true,
    note_to_payer: note.slice(0, 255),
  });
  return { captureId: res.id };
}

export async function voidAuthorization(authorizationId: string) {
  if (!paypalLive) return;
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
