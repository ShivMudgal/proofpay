import { respond, type RouteContext } from "@/lib/api";
import { currentUser } from "@/lib/session";
import { cancel } from "@/lib/services/milestones";

export async function POST(_req: Request, { params }: RouteContext) {
  return respond(async () => cancel((await params).id, await currentUser()));
}
