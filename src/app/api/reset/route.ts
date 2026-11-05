import { respond } from "@/lib/api";
import { resetDB } from "@/lib/db";

export const POST = () => respond(async () => resetDB());
