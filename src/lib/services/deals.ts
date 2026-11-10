import { id, mutate, nowISO, read } from "../db";
import { badRequest, forbidden, notFound } from "../errors";
import { agentTurn } from "../ai/negotiate";
import { draftContract } from "../ai/contract";
import { CURRENCY, formatINR } from "../money";
import type { User } from "../types";

const DAY_MS = 86_400_000;

async function loadDeal(jobId: string) {
  const db = await read();
  const job = db.jobs.find((j) => j.id === jobId);
  if (!job) throw notFound("Deal");
  return { db, job };
}

export async function postMessage(jobId: string, user: User, content: string) {
  if (user.role !== "CLIENT") throw forbidden("Only the client can message the agent");
  const text = content.trim().slice(0, 1000);
  if (!text) throw badRequest("Message is empty");

  const { db, job } = await loadDeal(jobId);
  if (job.status !== "NEGOTIATING") throw badRequest("This negotiation is closed");

  const rules = db.rules.find((r) => r.freelancerId === job.freelancerId)!;
  const freelancer = db.users.find((u) => u.id === job.freelancerId)!;
  const clientMsg = { id: id("m"), jobId, sender: "CLIENT" as const, content: text, createdAt: nowISO() };
  const history = [...db.messages.filter((m) => m.jobId === jobId), clientMsg];

  const turn = await agentTurn(job, rules, history, freelancer.name);

  return mutate((d) => {
    d.messages.push(clientMsg, {
      id: id("m"),
      jobId,
      sender: "AGENT",
      content: turn.reply,
      offer: turn.offer,
      createdAt: nowISO(),
    });
    d.jobs.find((j) => j.id === jobId)!.currentOffer = turn.offer;
    return {
      reply: turn.reply,
      offer: turn.offer,
      clientSeemsToAccept: turn.clientSeemsToAccept,
      engine: turn.engine,
      guardrail: turn.guardrail,
    };
  });
}

export async function acceptTerms(jobId: string, user: User) {
  if (user.role !== "CLIENT") throw forbidden("Only the client can accept terms");

  await mutate((d) => {
    const job = d.jobs.find((j) => j.id === jobId);
    if (!job) throw notFound("Deal");
    if (!job.currentOffer) throw badRequest("There are no terms to accept yet");
    if (job.status !== "NEGOTIATING") return;

    const { price, deadlineDays, milestones } = job.currentOffer;
    job.status = "AGREED";
    d.messages.push({
      id: id("m"),
      jobId,
      sender: "SYSTEM",
      content: `Terms accepted: ${formatINR(price)}, ${deadlineDays} days, ${milestones.length} milestones.`,
      createdAt: nowISO(),
    });
  });

  return createContract(jobId);
}

export async function createContract(jobId: string) {
  const { db, job } = await loadDeal(jobId);
  if (job.contractId) return { contractId: job.contractId };
  if (job.status !== "AGREED" || !job.currentOffer) throw badRequest("Accept the terms first");

  const rules = db.rules.find((r) => r.freelancerId === job.freelancerId)!;
  const draft = await draftContract(job, job.currentOffer, rules, db.messages.filter((m) => m.jobId === jobId));

  return mutate((d) => {
    const j = d.jobs.find((x) => x.id === jobId)!;
    if (j.contractId) return { contractId: j.contractId };

    const contractId = id("ct");
    const start = Date.now();
    d.contracts.push({
      id: contractId,
      jobId,
      clientId: j.clientId,
      freelancerId: j.freelancerId,
      title: draft.title,
      summary: draft.summary,
      totalAmount: j.currentOffer!.price,
      currency: CURRENCY,
      createdAt: nowISO(),
    });

    draft.milestones.forEach((m, index) => {
      d.milestones.push({
        id: id("ms"),
        contractId,
        index,
        name: m.name,
        amount: m.amount,
        dueDate: new Date(start + m.dueInDays * DAY_MS).toISOString(),
        acceptanceCriteria: m.acceptanceCriteria,
        status: "PENDING",
        paypalOrderId: null,
        authorizationId: null,
        captureId: null,
        timeline: [{ at: nowISO(), label: "Milestone created" }],
      });
    });

    j.status = "CONTRACTED";
    j.contractId = contractId;
    return { contractId };
  });
}
