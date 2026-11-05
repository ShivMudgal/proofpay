import { respond, type RouteContext } from "@/lib/api";
import { currentUser } from "@/lib/session";
import { createOrder } from "@/lib/services/milestones";

export async function POST(_req: Request, { params }: RouteContext) {
  return respond(async () => createOrder((await params).id, await currentUser()));
}
