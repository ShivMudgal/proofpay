import { respond, type RouteContext } from "@/lib/api";
import { currentUser } from "@/lib/session";
import { postMessage } from "@/lib/services/deals";

export async function POST(req: Request, { params }: RouteContext) {
  return respond(async () => {
    const { content } = await req.json();
    return postMessage((await params).id, await currentUser(), String(content ?? ""));
  });
}
