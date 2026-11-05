import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { DB } from "./types";
import { seedData } from "./seed";

// Single-process JSON store. Writes are queued so concurrent requests don't clobber each other.
// Swap for Postgres before running more than one instance.
const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "db.json");

let state: DB | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();

function load(): DB {
  if (state) return state;
  try {
    state = JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as DB;
  } catch {
    state = seedData();
    save(state);
  }
  return state;
}

function save(db: DB) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const tmp = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_PATH);
}

export const read = load;

export function mutate<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  const job = writeQueue.then(async () => {
    const db = load();
    const result = await fn(db);
    save(db);
    return result;
  });
  writeQueue = job.catch(() => undefined);
  return job;
}

export function resetDB() {
  state = seedData();
  save(state);
}

export const id = (prefix: string) => `${prefix}_${crypto.randomBytes(5).toString("hex")}`;
export const nowISO = () => new Date().toISOString();
