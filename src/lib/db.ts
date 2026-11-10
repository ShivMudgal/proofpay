import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Pool, type PoolClient } from "pg";
import type { DB } from "./types";
import { seedData } from "./seed";

// Two backends behind one API:
// - Postgres (Neon) when DATABASE_URL is set. The app state is one JSONB document in a single row.
//   Every write runs in a transaction that locks that row, so concurrent requests and multiple
//   instances never overwrite each other. Data survives redeploys.
// - A local JSON file otherwise, so the app still runs with no keys at all.

const DATABASE_URL = process.env.DATABASE_URL?.trim();
export const dbBackend: "postgres" | "file" = DATABASE_URL ? "postgres" : "file";

// ---------- Postgres ----------

const STATE_ID = 1;

declare global {
  // Reuse the pool across hot reloads in dev.
  var __proofpayPool: Pool | undefined;
  var __proofpayReady: Promise<void> | undefined;
}

function pool(): Pool {
  if (!globalThis.__proofpayPool) {
    globalThis.__proofpayPool = new Pool({ connectionString: DATABASE_URL, max: 5, idleTimeoutMillis: 30_000 });
  }
  return globalThis.__proofpayPool;
}

function ready(): Promise<void> {
  if (!globalThis.__proofpayReady) {
    globalThis.__proofpayReady = (async () => {
      await pool().query(`
        CREATE TABLE IF NOT EXISTS proofpay_state (
          id         integer PRIMARY KEY,
          data       jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        )`);
      await pool().query(
        "INSERT INTO proofpay_state (id, data) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
        [STATE_ID, JSON.stringify(seedData())],
      );
    })().catch((err) => {
      globalThis.__proofpayReady = undefined; // retry on the next request
      throw err;
    });
  }
  return globalThis.__proofpayReady;
}

async function pgRead(): Promise<DB> {
  await ready();
  const { rows } = await pool().query<{ data: DB }>("SELECT data FROM proofpay_state WHERE id = $1", [STATE_ID]);
  return rows[0].data;
}

async function pgMutate<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  await ready();
  const client: PoolClient = await pool().connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query<{ data: DB }>(
      "SELECT data FROM proofpay_state WHERE id = $1 FOR UPDATE",
      [STATE_ID],
    );
    const db = rows[0].data;
    const result = await fn(db);
    await client.query("UPDATE proofpay_state SET data = $2, updated_at = now() WHERE id = $1", [
      STATE_ID,
      JSON.stringify(db),
    ]);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

async function pgReset(): Promise<void> {
  await ready();
  await pool().query("UPDATE proofpay_state SET data = $2, updated_at = now() WHERE id = $1", [
    STATE_ID,
    JSON.stringify(seedData()),
  ]);
}

// ---------- JSON file ----------

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "data", "db.json");
let fileState: DB | null = null;
let writeQueue: Promise<unknown> = Promise.resolve();

function fileLoad(): DB {
  if (fileState) return fileState;
  try {
    fileState = JSON.parse(fs.readFileSync(DB_PATH, "utf8")) as DB;
  } catch {
    fileState = seedData();
    fileSave(fileState);
  }
  return fileState;
}

function fileSave(db: DB) {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const tmp = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_PATH);
}

function fileMutate<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  const job = writeQueue.then(async () => {
    const db = fileLoad();
    const result = await fn(db);
    fileSave(db);
    return result;
  });
  writeQueue = job.catch(() => undefined);
  return job;
}

// ---------- Public API ----------

/** A snapshot of the current state. Don't modify it; use mutate() for writes. */
export async function read(): Promise<DB> {
  return dbBackend === "postgres" ? pgRead() : fileLoad();
}

/** Runs fn against the latest state and saves its changes atomically. */
export function mutate<T>(fn: (db: DB) => T | Promise<T>): Promise<T> {
  return dbBackend === "postgres" ? pgMutate(fn) : fileMutate(fn);
}

export async function resetDB(): Promise<void> {
  if (dbBackend === "postgres") return pgReset();
  fileState = seedData();
  fileSave(fileState);
}

export const id = (prefix: string) => `${prefix}_${crypto.randomBytes(5).toString("hex")}`;
export const nowISO = () => new Date().toISOString();
