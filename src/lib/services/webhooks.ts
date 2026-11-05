import { mutate, nowISO } from "../db";

type PayPalEvent = {
  id: string;
  event_type: string;
  resource?: {
    id?: string;
    supplementary_data?: { related_ids?: { authorization_id?: string } };
  };
};

export function handlePayPalEvent(event: PayPalEvent) {
  return mutate((d) => {
    if (d.webhookEvents.some((e) => e.id === event.id)) return { duplicate: true };
    d.webhookEvents.push({ id: event.id, type: event.event_type, at: nowISO() });

    const resource = event.resource ?? {};
    const authorizationId = event.event_type.startsWith("PAYMENT.AUTHORIZATION")
      ? resource.id
      : resource.supplementary_data?.related_ids?.authorization_id;

    const m = d.milestones.find((x) => x.authorizationId && x.authorizationId === authorizationId);
    if (!m) return { matched: false };

    const log = (label: string, detail?: string) => m.timeline.push({ at: nowISO(), label, detail });

    switch (event.event_type) {
      case "PAYMENT.CAPTURE.COMPLETED":
        m.status = "RELEASED";
        m.captureId ??= resource.id ?? null;
        log("PayPal confirmed capture", resource.id);
        break;
      case "PAYMENT.AUTHORIZATION.VOIDED":
        m.status = "VOIDED";
        log("PayPal confirmed void");
        break;
      case "PAYMENT.CAPTURE.REFUNDED":
        log("Capture refunded", resource.id);
        break;
      default:
        log(event.event_type);
    }
    return { matched: true };
  });
}
