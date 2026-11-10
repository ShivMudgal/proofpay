import { NextResponse } from "next/server";
import { describeError } from "@/lib/api";
import { verifyWebhookSignature } from "@/lib/paypal";
import { handlePayPalEvent } from "@/lib/services/webhooks";

export async function POST(req: Request) {
  const raw = await req.text();
  try {
    if (!(await verifyWebhookSignature(req.headers, raw))) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    return NextResponse.json(await handlePayPalEvent(JSON.parse(raw)));
  } catch (err) {
    console.error("paypal webhook", err);
    const { status, message } = describeError(err);
    return NextResponse.json({ error: `Webhook processing failed: ${message}` }, { status });
  }
}
