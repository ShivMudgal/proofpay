import { respond, type RouteContext } from "@/lib/api";
import { currentUser } from "@/lib/session";
import { authorize } from "@/lib/services/milestones";

export async function POST(req: Request, { params }: RouteContext) {
  return respond(async () => {
    const { orderId } = await req.json();
    return authorize((await params).id, String(orderId), await currentUser());
  });
}
