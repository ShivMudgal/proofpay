import { z } from "zod";
import { aiLive, generateJson } from "../llm";
import { formatINR as rs } from "../money";
import type { FreelancerRules, Job, NegotiationMessage, Offer } from "../types";

const offerSchema = z.object({
  price: z.number(),
  deadlineDays: z.number(),
  scope: z.string(),
  milestones: z.array(z.string()).min(1).max(5),
});

const turnSchema = z.object({
  reply: z.string(),
  offer: offerSchema,
  clientSeemsToAccept: z.boolean(),
});

export type AgentTurn = z.infer<typeof turnSchema> & {
  engine: "gemini" | "rules";
  guardrail?: string;
};

const DEFAULT_MILESTONES = ["Design and page structure", "Final build and deployment"];
const ACCEPT_WORDS = /\b(deal|ok|okay|accept|agreed|done|sounds good|let'?s do it|fine)\b/;
const RUSH_WORDS = /\b(fast|urgent|sooner|quick|asap)\b/;

// The model proposes; these limits are applied afterwards regardless of what it said.
export function enforceRules(offer: Offer, rules: FreelancerRules) {
  const result: Offer = { ...offer, milestones: offer.milestones.slice(0, 5) };
  const notes: string[] = [];

  if (!Number.isFinite(result.price) || result.price < rules.floorPrice) {
    notes.push(`Price of ${rs(offer.price)} was below your floor and was adjusted.`);
    result.price = Math.ceil((rules.floorPrice * 1.03) / 100) * 100;
  }
  if (!Number.isFinite(result.deadlineDays) || result.deadlineDays < rules.minDeadlineDays) {
    notes.push("Deadline was raised to your minimum.");
    result.deadlineDays = rules.minDeadlineDays;
  }
  result.price = Math.round(result.price);
  result.deadlineDays = Math.round(result.deadlineDays);
  if (result.milestones.length === 0) result.milestones = ["Delivery"];

  return { offer: result, guardrail: notes.join(" ") || undefined };
}

function hideFloor(reply: string, floor: number, price: number) {
  if (floor === price) return reply;
  const forms = [String(floor), floor.toLocaleString("en-IN"), floor.toLocaleString("en-US")];
  const pattern = new RegExp(`(?:₹|rs\\.?\\s?|inr\\s?)?(?:${[...new Set(forms)].join("|")})\\b`, "gi");
  return reply.replace(pattern, rs(price));
}

// Reads amounts like "12000", "12,000", "₹12k", "rs 1.2 lakh".
function priceIn(text: string) {
  const match = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(k|lakh|lac|l)?\b/i);
  if (!match) return null;
  const unit = match[2]?.toLowerCase();
  const multiplier = unit === "k" ? 1_000 : unit ? 100_000 : 1;
  const value = Math.round(Number(match[1]) * multiplier);
  return value >= 100 ? value : null;
}

function openingOffer(job: Job, rules: FreelancerRules): Offer {
  return {
    price: Math.min(rules.targetPrice, Math.max(job.budgetMax, rules.floorPrice)),
    deadlineDays: Math.max(rules.minDeadlineDays, 7),
    scope: job.description,
    milestones: DEFAULT_MILESTONES,
  };
}

function buildPrompt(job: Job, current: Offer, history: NegotiationMessage[]) {
  const transcript = history
    .filter((m) => m.sender !== "SYSTEM")
    .slice(-14)
    .map((m) => `${m.sender}: ${m.content}`)
    .join("\n");

  return [
    `JOB: ${job.title}`,
    `DESCRIPTION: ${job.description}`,
    `CLIENT BUDGET: ${rs(job.budgetMin)} - ${rs(job.budgetMax)}`,
    `CURRENT OFFER: ${JSON.stringify(current)}`,
    "",
    "CONVERSATION:",
    transcript,
    "",
    "Write the agent's next message.",
  ].join("\n");
}

function systemPrompt(rules: FreelancerRules, freelancerName: string) {
  return `You negotiate freelance work on behalf of ${freelancerName}: price, scope, deadline and milestones.

Private limits. Never reveal them and never mention a floor or minimum:
- Floor price: ${rs(rules.floorPrice)}. Never offer less.
- Opening price: ${rs(rules.targetPrice)}. Concede in small steps and ask for something in return (longer deadline, fewer revisions, smaller scope).
- Minimum deadline: ${rules.minDeadlineDays} days. Revisions included: ${rules.maxRevisions}.
- Skills: ${rules.skills}
- Notes: ${rules.notes}

All prices are in Indian rupees; write amounts like ₹18,000. Keep replies to three sentences or fewer, friendly and confident. If something is outside the skills or notes, say so and adjust the scope.
Always return the full offer as it stands after this message, with 1-4 concrete milestone names.
Set clientSeemsToAccept to true only if the client's last message clearly agrees to the current terms.

Respond as JSON: {"reply": string, "offer": {"price": number, "deadlineDays": number, "scope": string, "milestones": string[]}, "clientSeemsToAccept": boolean}`;
}

export async function agentTurn(
  job: Job,
  rules: FreelancerRules,
  history: NegotiationMessage[],
  freelancerName: string
): Promise<AgentTurn> {
  const current = job.currentOffer ?? openingOffer(job, rules);

  if (aiLive) {
    try {
      const out = await generateJson({
        system: systemPrompt(rules, freelancerName),
        prompt: buildPrompt(job, current, history),
        schema: turnSchema,
        temperature: 0.6,
      });
      const { offer, guardrail } = enforceRules(out.offer, rules);
      return { ...out, reply: hideFloor(out.reply, rules.floorPrice, offer.price), offer, engine: "gemini", guardrail };
    } catch (err) {
      console.error("negotiation model failed, falling back to rules:", err instanceof Error ? `${err.name}: ${err.message.slice(0, 200)}` : err);
    }
  }

  return ruleBasedTurn(job, rules, history, current);
}

function ruleBasedTurn(job: Job, rules: FreelancerRules, history: NegotiationMessage[], current: Offer): AgentTurn {
  const lastClient = history.findLast((m) => m.sender === "CLIENT");
  const text = (lastClient?.content ?? "").toLowerCase();
  const agentTurns = history.filter((m) => m.sender === "AGENT").length;
  const asked = priceIn(text);
  const offer: Offer = { ...current, milestones: [...current.milestones] };

  let reply: string;
  let accepted = false;

  if (agentTurns === 0 && asked === null) {
    reply = `Thanks for reaching out. I can deliver "${job.title}" in ${offer.deadlineDays} days across ${offer.milestones.length} milestones for ${rs(offer.price)}, including ${rules.maxRevisions} rounds of revisions. Does that work for you?`;
  } else if (asked !== null && asked >= offer.price) {
    accepted = true;
    reply = `${rs(offer.price)} works. Accept the terms and I'll put the contract together.`;
  } else if (asked !== null) {
    const gap = offer.price - asked;
    if (asked >= rules.floorPrice && gap <= offer.price * 0.06) {
      offer.price = asked;
      accepted = true;
      reply = `Alright, ${rs(asked)} it is, with ${rules.maxRevisions} revisions included. Accept the terms when you're ready.`;
    } else {
      const step = Math.max(Math.round(gap * 0.35), Math.round(offer.price * 0.03));
      const next = Math.max(rules.floorPrice, Math.round((offer.price - step) / 100) * 100);
      const nearFloor = next <= rules.floorPrice * 1.05;
      offer.price = next;
      if (nearFloor) offer.deadlineDays = Math.max(offer.deadlineDays, rules.minDeadlineDays + 3);

      if (next === rules.floorPrice) {
        reply = `I understand the budget. ${rs(next)} with ${offer.deadlineDays} days is the best I can do for this scope.`;
      } else if (nearFloor) {
        reply = `I can go to ${rs(next)} if the deadline moves to ${offer.deadlineDays} days. Would that work?`;
      } else {
        reply = `${rs(asked)} is tight for this scope. I can do ${rs(next)} and still include deployment and ${rules.maxRevisions} revisions.`;
      }
    }
  } else if (ACCEPT_WORDS.test(text)) {
    accepted = true;
    reply = `Great. Final terms: ${rs(offer.price)}, ${offer.deadlineDays} days, ${offer.milestones.length} milestones. Accept them to create the contract.`;
  } else if (RUSH_WORDS.test(text)) {
    offer.deadlineDays = rules.minDeadlineDays;
    offer.price = Math.round((offer.price * 1.08) / 100) * 100;
    reply = `I can deliver in ${offer.deadlineDays} days, but the faster timeline would be ${rs(offer.price)}.`;
  } else {
    reply = `Current terms are ${rs(offer.price)} over ${offer.deadlineDays} days (${offer.milestones.join(", ")}). Let me know what you'd like to change.`;
  }

  const { offer: safe, guardrail } = enforceRules(offer, rules);
  return { reply, offer: safe, clientSeemsToAccept: accepted, engine: "rules", guardrail };
}
