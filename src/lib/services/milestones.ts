import { id, mutate, nowISO, read } from "../db";
import { badRequest, forbidden, notFound } from "../errors";
import * as paypal from "../paypal";
import { formatINR, paypalCharge } from "../money";
import { reviewSubmission } from "../ai/verify";
import type { Milestone, MilestoneStatus, Submission, User } from "../types";
import { HOLD_EXPIRED_LABEL } from "../labels";

const SUBMITTABLE: MilestoneStatus[] = ["FUNDED", "REJECTED"];

async function load(milestoneId: string) {
  const db = await read();
  const milestone = db.milestones.find((m) => m.id === milestoneId);
  if (!milestone) throw notFound("Milestone");
  const contract = db.contracts.find((c) => c.id === milestone.contractId)!;
  return { db, milestone, contract };
}

function addEvent(m: Milestone, label: string, detail?: string) {
  m.timeline.push({ at: nowISO(), label, detail });
}

function update<T>(milestoneId: string, fn: (m: Milestone) => T) {
  return mutate((d) => fn(d.milestones.find((m) => m.id === milestoneId)!));
}

const money = (n: number) => formatINR(n, !Number.isInteger(n));

export async function createOrder(milestoneId: string, user: User) {
  const { db, milestone, contract } = await load(milestoneId);
  if (user.id !== contract.clientId) throw forbidden("Only the client can fund milestones");
  if (milestone.status !== "PENDING") throw badRequest("Milestone is already funded");

  const freelancer = db.users.find((u) => u.id === contract.freelancerId)!;
  const charge = paypalCharge(milestone.amount);
  const { orderId } = await paypal.createOrder({
    referenceId: milestoneId,
    description: `${contract.title} – ${milestone.name}`,
    amount: charge,
    payeeEmail: freelancer.paypalEmail,
  });

  await update(milestoneId, (m) => {
    m.paypalOrderId = orderId;
    addEvent(m, "PayPal order created", `${orderId} · ${charge.currency} ${charge.value}`);
  });
  return { orderId };
}

export async function authorize(milestoneId: string, orderId: string, user: User) {
  const { milestone, contract } = await load(milestoneId);
  if (user.id !== contract.clientId) throw forbidden("Only the client can fund milestones");
  if (milestone.status !== "PENDING") throw badRequest("Milestone is already funded");
  if (milestone.paypalOrderId !== orderId) throw badRequest("Order does not match this milestone");

  const { authorizationId, expiresAt } = await paypal.authorizeOrder(orderId);

  return update(milestoneId, (m) => {
    m.authorizationId = authorizationId;
    m.status = "FUNDED";
    const until = expiresAt ? `, valid until ${expiresAt.slice(0, 10)}` : "";
    addEvent(m, `${money(m.amount)} authorized and held`, `${authorizationId}${until}`);
    return m;
  });
}

export async function submitWork(milestoneId: string, user: User, type: Submission["type"], rawValue: string) {
  const { milestone, contract } = await load(milestoneId);
  if (user.id !== contract.freelancerId) throw forbidden("Only the freelancer can submit work");
  if (!SUBMITTABLE.includes(milestone.status)) throw badRequest("Milestone must be funded before submitting");

  const value = rawValue.trim();
  if (!value) throw badRequest("Submission is empty");

  const submissionId = id("sub");
  await mutate((d) => {
    const m = d.milestones.find((x) => x.id === milestoneId)!;
    m.status = "SUBMITTED";
    addEvent(m, "Work submitted", `${type.toLowerCase()}: ${value.slice(0, 120)}`);
    d.submissions.push({ id: submissionId, milestoneId, type, value, result: null, createdAt: nowISO() });
  });

  const { evidencePreview, ...review } = await reviewSubmission(milestone, { type, value });

  let captureId: string | null = null;
  let captureError: string | null = null;
  let holdExpired = false;
  if (review.overallPass && milestone.authorizationId) {
    try {
      ({ captureId } = await paypal.captureAuthorization(milestone.authorizationId, `Milestone "${milestone.name}" approved`));
    } catch (err) {
      captureError = err instanceof Error ? err.message : String(err);
      if (paypal.isHoldGone(err)) {
        holdExpired = true;
        // Best effort: release anything PayPal might still hold. It usually reports the hold is already gone.
        await paypal.voidAuthorization(milestone.authorizationId).catch(() => undefined);
      }
      console.error(`capture failed for ${milestoneId}`, captureError);
    }
  }

  return mutate((d) => {
    const m = d.milestones.find((x) => x.id === milestoneId)!;
    d.submissions.find((s) => s.id === submissionId)!.result = review;

    const met = review.criteria.filter((c) => c.passed).length;
    addEvent(m, review.overallPass ? "Review passed" : "Changes requested", `${met}/${review.criteria.length} criteria met, score ${review.score}`);

    let notice: string | null = null;
    if (captureId) {
      m.captureId = captureId;
      m.status = "RELEASED";
      addEvent(m, `${money(m.amount)} paid to freelancer`, captureId);
    } else if (holdExpired) {
      // The money is no longer held, so the milestone goes back to unfunded and the client funds it again.
      const old = m.authorizationId;
      m.status = "PENDING";
      m.paypalOrderId = null;
      m.authorizationId = null;
      addEvent(m, HOLD_EXPIRED_LABEL, `PayPal no longer holds authorization ${old}. The client was not charged.`);
      notice = HOLD_EXPIRED_NOTICE;
    } else if (captureError) {
      m.status = "FUNDED";
      addEvent(m, "Capture failed", captureError.slice(0, 200));
      notice = "The work passed review, but PayPal couldn't release the payment just now. The money is still held. Please try submitting again in a moment.";
    } else {
      m.status = "REJECTED";
    }
    return { milestone: m, result: review, notice, evidencePreview };
  });
}

const HOLD_EXPIRED_NOTICE =
  "The work passed review, but the PayPal hold on this milestone had expired, so no money was taken. The milestone is back to unfunded: the client needs to fund it again, then the work can be resubmitted.";

export async function cancel(milestoneId: string, user: User) {
  const { milestone, contract } = await load(milestoneId);
  if (user.id !== contract.clientId) throw forbidden("Only the client can cancel a milestone");
  if (!SUBMITTABLE.includes(milestone.status) || !milestone.authorizationId) throw badRequest("There is no hold to cancel");

  let alreadyGone = false;
  try {
    await paypal.voidAuthorization(milestone.authorizationId);
  } catch (err) {
    if (!paypal.isHoldGone(err)) throw err;
    alreadyGone = true; // Expired or voided on PayPal's side: nothing is held, so cancelling still succeeds.
  }

  return update(milestoneId, (m) => {
    m.status = "VOIDED";
    addEvent(m, alreadyGone ? "Hold had already expired" : "Authorization voided", "Client was not charged");
    return m;
  });
}
