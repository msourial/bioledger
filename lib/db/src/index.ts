import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import type { WorkReceipt, InsertWorkReceipt } from "./schema";

const { Pool } = pg;

const hasDb = Boolean(process.env.DATABASE_URL);

const pool = hasDb ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;
const realDb = pool ? drizzle(pool, { schema }) : null;

// ─── In-memory fallback when no DATABASE_URL is set ──────────────────────
const memoryStore: WorkReceipt[] = [];
let memoryId = 1;

export const inMemory = {
  insert(data: InsertWorkReceipt): WorkReceipt {
    const row: WorkReceipt = {
      id: memoryId++,
      nullifierHash: data.nullifierHash,
      sessionStats: data.sessionStats,
      companionSignature: data.companionSignature,
      receiptCid: data.receiptCid ?? null,
      cidStatus: data.cidStatus ?? 'pending',
      isDemo: data.isDemo ?? false,
      physicalIntegrity: data.physicalIntegrity ?? null,
      receiptType: data.receiptType ?? 'work',
      insightText: data.insightText ?? null,
      createdAt: new Date(),
    };
    memoryStore.push(row);
    return row;
  },
  select(nullifierHash?: string): WorkReceipt[] {
    if (!nullifierHash) return [...memoryStore];
    return memoryStore.filter((r) => r.nullifierHash === nullifierHash);
  },
};

export { pool, realDb as db, hasDb };
export * from "./schema";
