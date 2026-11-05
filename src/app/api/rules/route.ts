import { z } from "zod";
import { respond } from "@/lib/api";
import { mutate } from "@/lib/db";
import { badRequest, forbidden } from "@/lib/errors";
import { currentUser } from "@/lib/session";

const schema = z.object({
  floorPrice: z.coerce.number().positive(),
  targetPrice: z.coerce.number().positive(),
  minDeadlineDays: z.coerce.number().int().positive(),
  maxRevisions: z.coerce.number().int().min(0),
  skills: z.string().max(500),
  notes: z.string().max(1000),
  paypalEmail: z.string().email(),
});

export async function PUT(req: Request) {
  return respond(async () => {
    const user = await currentUser();
    if (user.role !== "FREELANCER") throw forbidden("Only freelancers have agent settings");

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid settings");

    const { paypalEmail, ...rules } = parsed.data;
    if (rules.targetPrice < rules.floorPrice) throw badRequest("Opening price can't be below the floor price");

    return mutate((d) => {
      Object.assign(d.rules.find((r) => r.freelancerId === user.id)!, rules);
      d.users.find((u) => u.id === user.id)!.paypalEmail = paypalEmail;
      return { ok: true };
    });
  });
}
