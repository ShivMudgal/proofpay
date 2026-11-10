import { z } from "zod";
import { aiLive, generateJson } from "../llm";
import { formatINR } from "../money";
import type { FreelancerRules, Job, NegotiationMessage, Offer } from "../types";

const contractSchema = z.object({
  title: z.string(),
  summary: z.string(),
  milestones: z
    .array(
      z.object({
        name: z.string(),
        sharePercent: z.number(),
        dueInDays: z.number(),
        acceptanceCriteria: z.array(z.string()).min(2).max(7),
      })
    )
    .min(1)
    .max(5),
});

export type DraftContract = {
  title: string;
  summary: string;
  milestones: { name: string; amount: number; dueInDays: number; acceptanceCriteria: string[] }[];
};

// Splits a total by weights in whole cents, so the parts always add back to the total.
export function allocate(total: number, weights: number[]): number[] {
  const clean = weights.map((w) => (w > 0 ? w : 0));
  const sum = clean.reduce((a, b) => a + b, 0);
  const shares = sum > 0 ? clean.map((w) => w / sum) : clean.map(() => 1 / clean.length);

  const cents = Math.round(total * 100);
  const parts = shares.map((s) => Math.floor(cents * s));
  let remainder = cents - parts.reduce((a, b) => a + b, 0);
  for (let i = parts.length - 1; remainder > 0; i = (i - 1 + parts.length) % parts.length) {
    parts[i]++;
    remainder--;
  }
  return parts.map((c) => c / 100);
}

const SYSTEM = `You turn a finished freelance negotiation into a milestone contract.

Acceptance criteria must be objective and checkable from a GitHub repository, a live URL or a text deliverable.
Good: "Contact form has name, email and message fields", "Menu lists 6 items with prices", "Site is reachable at a public URL".
Bad: "Looks good", "High quality".

All amounts are in Indian rupees (INR). Use the agreed milestones. sharePercent values must add up to 100. dueInDays counts from the contract start, and the last milestone is due on the agreed deadline.

Respond as JSON: {"title": string, "summary": string, "milestones": [{"name": string, "sharePercent": number, "dueInDays": number, "acceptanceCriteria": string[]}]}`;

export async function draftContract(
  job: Job,
  offer: Offer,
  rules: FreelancerRules,
  history: NegotiationMessage[]
): Promise<DraftContract> {
  if (aiLive) {
    try {
      const transcript = history
        .filter((m) => m.sender !== "SYSTEM")
        .map((m) => `${m.sender}: ${m.content}`)
        .join("\n");

      const out = await generateJson({
        system: SYSTEM,
        schema: contractSchema,
        temperature: 0.2,
        prompt: `JOB: ${job.title}\nDESCRIPTION: ${job.description}\nAGREED TERMS: ${JSON.stringify(offer)}\nFREELANCER NOTES: ${rules.notes}\n\nNEGOTIATION:\n${transcript}`,
      });

      const amounts = allocate(offer.price, out.milestones.map((m) => m.sharePercent));
      return {
        title: out.title,
        summary: out.summary,
        milestones: out.milestones.map((m, i) => ({
          name: m.name,
          amount: amounts[i],
          dueInDays: Math.min(Math.max(1, Math.round(m.dueInDays)), offer.deadlineDays),
          acceptanceCriteria: m.acceptanceCriteria,
        })),
      };
    } catch (err) {
      console.error("contract model failed, falling back to rules:", err instanceof Error ? `${err.name}: ${err.message.slice(0, 200)}` : err);
    }
  }
  return ruleBasedContract(job, offer);
}

function requirementsFrom(description: string) {
  return description
    .split(/,|\band\b|\bwith\b|\.|;/i)
    .map((s) => s.trim().replace(/^(i need|i want|need|should be|must be)\s+(an?\s+)?/i, ""))
    .filter((s) => s.length > 3 && !/deploy|online|live/i.test(s));
}

function ruleBasedContract(job: Job, offer: Offer): DraftContract {
  const reqs = requirementsFrom(job.description);
  const count = offer.milestones.length;
  const perMilestone = Math.max(1, Math.ceil(reqs.length / count));
  const weights = offer.milestones.map((_, i) => (i === count - 1 ? 60 : 40 / Math.max(1, count - 1)));
  const amounts = allocate(offer.price, weights);

  return {
    title: job.title,
    summary: `${offer.deadlineDays}-day engagement for ${formatINR(offer.price)}, paid in ${count} milestones.`,
    milestones: offer.milestones.map((name, i) => {
      const criteria = reqs.slice(i * perMilestone, (i + 1) * perMilestone).map((r) => `Includes ${r}`);
      if (i === count - 1) criteria.push("Project is deployed and reachable at a public URL");
      criteria.push("Source code is in a public repository with a README");
      return {
        name,
        amount: amounts[i],
        dueInDays: Math.round(((i + 1) / count) * offer.deadlineDays),
        acceptanceCriteria: [...new Set(criteria)].slice(0, 6),
      };
    }),
  };
}
