// Adds the showcase deals (src/lib/showcase.ts) to the current datastore, only if they aren't there yet.
// Safe to run any number of times. It only appends: existing deals, contracts, milestones and PayPal IDs
// are never changed or removed.
//
//   npm run showcase            uses DATABASE_URL from .env (Neon), or data/db.json without it
import fs from "node:fs";

if (fs.existsSync(".env")) process.loadEnvFile(".env");

async function main() {
  // Import after loading .env, because db.ts picks its backend when it loads.
  const { dbBackend, mutate } = await import("../src/lib/db");
  const { showcaseDeals } = await import("../src/lib/showcase");

  console.log(`Datastore: ${dbBackend === "postgres" ? "Neon Postgres (DATABASE_URL)" : "local JSON file (DB_PATH or data/db.json)"}`);

  const report = await mutate((db) => {
    const lines: string[] = [];
    for (const deal of showcaseDeals()) {
      const { job } = deal;
      const exists = db.jobs.some((j) => j.id === job.id || j.title.trim().toLowerCase() === job.title.trim().toLowerCase());
      if (exists) {
        lines.push(`skipped  "${job.title}" (already exists)`);
        continue;
      }

      const has = <T extends { id: string }>(list: T[], id: string) => list.some((x) => x.id === id);
      db.jobs.push(job);
      db.messages.push(...deal.messages.filter((m) => !has(db.messages, m.id)));
      if (deal.contract && !has(db.contracts, deal.contract.id)) db.contracts.push(deal.contract);
      db.milestones.push(...deal.milestones.filter((m) => !has(db.milestones, m.id)));

      const extra = deal.contract ? `, contract with ${deal.milestones.length} unfunded milestones` : "";
      lines.push(`added    "${job.title}" (${job.status}, ${deal.messages.length} messages${extra})`);
    }
    lines.push(`Total deals now: ${db.jobs.length}`);
    return lines;
  });

  for (const line of report) console.log(line);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Failed:", err instanceof Error ? err.message.replace(/postgres(ql)?:\/\/\S+/g, "<DATABASE_URL>") : err);
    process.exit(1);
  });
