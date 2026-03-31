import { Router, type IRouter } from "express";
import { db, hasDb, inMemory, workReceiptsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateReceiptBody, ListReceiptsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

function formatReceipt(r: any) {
  return {
    id: r.id,
    nullifierHash: r.nullifierHash,
    sessionStats: r.sessionStats,
    companionSignature: r.companionSignature,
    receiptCid: r.receiptCid ?? undefined,
    cidStatus: (r.cidStatus ?? "pending") as "pending" | "stored" | "failed",
    isDemo: r.isDemo ?? false,
    physicalIntegrity: r.physicalIntegrity ?? undefined,
    receiptType: (r.receiptType ?? "work") as "work" | "insight",
    insightText: r.insightText ?? undefined,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  };
}

router.get("/receipts", async (req, res) => {
  const query = ListReceiptsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "Invalid query params", details: query.error.message });
    return;
  }

  const { nullifier } = query.data;

  if (!nullifier) {
    res.status(400).json({ error: "nullifier query param is required" });
    return;
  }

  if (hasDb && db) {
    const receipts = await db
      .select()
      .from(workReceiptsTable)
      .where(eq(workReceiptsTable.nullifierHash, nullifier))
      .orderBy(workReceiptsTable.createdAt);
    res.json(receipts.map(formatReceipt));
  } else {
    res.json(inMemory.select(nullifier).map(formatReceipt));
  }
});

router.post("/receipts", async (req, res) => {
  const body = CreateReceiptBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", details: body.error.message });
    return;
  }

  const { nullifierHash, sessionStats, companionSignature, receiptCid, cidStatus, isDemo, physicalIntegrity, receiptType, insightText } = body.data;

  const data = {
    nullifierHash,
    sessionStats,
    companionSignature,
    receiptCid: receiptCid ?? null,
    cidStatus: cidStatus ?? "pending",
    isDemo: isDemo ?? false,
    physicalIntegrity: physicalIntegrity ?? null,
    receiptType: receiptType ?? "work",
    insightText: insightText ?? null,
  };

  let inserted: any;

  if (hasDb && db) {
    [inserted] = await db.insert(workReceiptsTable).values(data).returning();
  } else {
    inserted = inMemory.insert(data as any);
  }

  console.log("📝 ERC-8004 Receipt created — ID:", inserted.id, "Type:", inserted.receiptType ?? "work");
  res.status(201).json(formatReceipt(inserted));
});

export default router;
