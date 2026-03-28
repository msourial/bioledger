import { Router, type IRouter } from "express";
import { db, workReceiptsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateReceiptBody, ListReceiptsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

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

  const receipts = await db
    .select()
    .from(workReceiptsTable)
    .where(eq(workReceiptsTable.nullifierHash, nullifier))
    .orderBy(workReceiptsTable.createdAt);

  res.json(
    receipts.map((r) => ({
      id: r.id,
      nullifierHash: r.nullifierHash,
      sessionStats: r.sessionStats,
      companionSignature: r.companionSignature,
      receiptCid: r.receiptCid ?? undefined,
      physicalIntegrity: r.physicalIntegrity ?? undefined,
      createdAt: r.createdAt.toISOString(),
    }))
  );
});

router.post("/receipts", async (req, res) => {
  const body = CreateReceiptBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Validation error", details: body.error.message });
    return;
  }

  const { nullifierHash, sessionStats, companionSignature, receiptCid, physicalIntegrity } = body.data;

  const [inserted] = await db
    .insert(workReceiptsTable)
    .values({
      nullifierHash,
      sessionStats,
      companionSignature,
      receiptCid: receiptCid ?? null,
      physicalIntegrity: physicalIntegrity ?? null,
    })
    .returning();

  res.status(201).json({
    id: inserted.id,
    nullifierHash: inserted.nullifierHash,
    sessionStats: inserted.sessionStats,
    companionSignature: inserted.companionSignature,
    receiptCid: inserted.receiptCid ?? undefined,
    physicalIntegrity: inserted.physicalIntegrity ?? undefined,
    createdAt: inserted.createdAt.toISOString(),
  });
});

export default router;
