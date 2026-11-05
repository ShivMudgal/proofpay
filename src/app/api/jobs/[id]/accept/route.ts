import { respond, type RouteContext } from "@/lib/api";
import { currentUser } from "@/lib/session";
import { acceptTerms } from "@/lib/services/deals";

export async function POST(_req: Request, { params }: RouteContext) {
  return respond(async () => acceptTerms((await params).id, await currentUser()));
}
