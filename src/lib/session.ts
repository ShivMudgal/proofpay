import { cookies } from "next/headers";
import { read } from "./db";
import type { User } from "./types";

// Demo accounts only: the cookie selects one of the seeded users.
export async function currentUser(): Promise<User> {
  const userId = (await cookies()).get("pp_user")?.value ?? "u_client";
  const { users } = read();
  return users.find((u) => u.id === userId) ?? users[0];
}
