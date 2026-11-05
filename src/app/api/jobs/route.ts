import { z } from "zod";
import { respond } from "@/lib/api";
import { id, mutate, nowISO } from "@/lib/db";
import { badRequest, forbidden } from "@/lib/errors";
import { currentUser } from "@/lib/session";

const schema = z.object({
  title: z.string().trim().min(4).max(120),
  description: z.string().trim().min(20).max(2000),
  budgetMin: z.coerce.number().positive(),
  budgetMax: z.coerce.number().positive(),
});

export async function POST(req: Request) {
  return respond(async () => {
    const user = await currentUser();
    if (user.role !== "CLIENT") throw forbidden("Only clients can create deals");

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw badRequest("Title, a description of at least 20 characters and a budget are required");
    const { title, description, budgetMin, budgetMax } = parsed.data;

    return mutate((d) => {
      const freelancer = d.users.find((u) => u.role === "FREELANCER")!;
      const jobId = id("job");
      d.jobs.unshift({
        id: jobId,
        clientId: user.id,
        freelancerId: freelancer.id,
        title,
        description,
        budgetMin: Math.min(budgetMin, budgetMax),
        budgetMax: Math.max(budgetMin, budgetMax),
        status: "NEGOTIATING",
        currentOffer: null,
        contractId: null,
        createdAt: nowISO(),
      });
      d.messages.push({
        id: id("m"),
        jobId,
        sender: "SYSTEM",
        content: `Negotiation started with ${freelancer.name}'s agent.`,
        createdAt: nowISO(),
      });
      return { jobId };
    });
  });
}
