import { pgTable, serial, text, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const workReceiptsTable = pgTable("work_receipts", {
  id: serial("id").primaryKey(),
  nullifierHash: text("nullifier_hash").notNull(),
  sessionStats: jsonb("session_stats").notNull(),
  companionSignature: text("companion_signature").notNull(),
  receiptCid: text("receipt_cid"),
  cidStatus: text("cid_status").default("pending"),
  isDemo: boolean("is_demo").default(false),
  physicalIntegrity: boolean("physical_integrity"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertWorkReceiptSchema = createInsertSchema(workReceiptsTable).omit({ id: true, createdAt: true });
export type InsertWorkReceipt = z.infer<typeof insertWorkReceiptSchema>;
export type WorkReceipt = typeof workReceiptsTable.$inferSelect;
