import { z } from "zod";
import { respond, type RouteContext } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { currentUser } from "@/lib/session";
import { submitWork } from "@/lib/services/milestones";

export const maxDuration = 60;

const schema = z.object({
  type: z.enum(["GITHUB", "URL", "TEXT"]),
  value: z.string().min(1).max(20_000),
});

export async function POST(req: Request, { params }: RouteContext) {
  return respond(async () => {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) throw badRequest("Invalid submission");
    return submitWork((await params).id, await currentUser(), parsed.data.type, parsed.data.value);
  });
}
