import { respond } from "@/lib/api";
import { resetDB } from "@/lib/db";
import { forbidden } from "@/lib/errors";
import { demoResetEnabled } from "@/lib/flags";

export const dynamic = "force-dynamic";

export const POST = () =>
  respond(async () => {
    if (!demoResetEnabled()) throw forbidden("Demo reset is disabled");
    await resetDB();
  });
