// Read at request time (server only), so changing the env var needs a restart, not a rebuild.

/** The "Reset demo data" button and POST /api/reset are enabled only when ENABLE_DEMO_RESET=true. */
export function demoResetEnabled(): boolean {
  return process.env.ENABLE_DEMO_RESET?.trim().toLowerCase() === "true";
}
