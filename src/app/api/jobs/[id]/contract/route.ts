import { respond, type RouteContext } from "@/lib/api";
import { createContract } from "@/lib/services/deals";

export async function POST(_req: Request, { params }: RouteContext) {
  return respond(async () => createContract((await params).id));
}
