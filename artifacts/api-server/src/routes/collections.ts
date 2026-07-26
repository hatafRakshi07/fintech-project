import { Router, type IRouter } from "express";
import { db, paymentReceipts, paymentItems, customers, collectors, schemes, memberships, tokens, users } from "@workspace/db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { createNotification, notifyManagers } from "./notifications";

const router: IRouter = Router();

function genReceipt(): string {
  return `RCP${Date.now()}`;
}

router.get("/collections", async (req, res): Promise<void> => {
  try {
    const { customerId } = req.query;
    if (!customerId) {
      res.json({ data: [], total: 0 });
      return;
    }

    // Fetch the recent payment receipts for this customer
    const data = await db
      .select()
      .from(paymentReceipts)
      .where(eq(paymentReceipts.customerId, String(customerId)))
      .orderBy(desc(paymentReceipts.createdAt))
      .limit(50);
      
    res.json({ data, total: data.length });
  } catch (err) {
    console.error("[GET /collections ERROR]", err);
    res.status(500).json({ error: "Failed to fetch collections" });
  }
});

router.post("/collections", async (req, res): Promise<void> => {
  const {
    customerId,
    schemeId,
    amount,
    paymentMode,
    notes,
    screenshotUrl,
    tokenAllocations // { tokenId, amount }[]
  } = req.body;

  if (!customerId || !paymentMode || (!amount && (!tokenAllocations || tokenAllocations.length === 0))) {
    res.status(400).json({ error: "customerId, amount/tokenAllocations, paymentMode required" });
    return;
  }

  try {
    const collectorId = req.userRole === "collector" ? req.userId : null;
    
    // Create the master Payment Receipt
    const [receipt] = await db.insert(paymentReceipts).values({
      receiptNo: genReceipt(),
      customerId: String(customerId),
      collectorId: collectorId ? String(collectorId) : null,
      paymentMethod: paymentMode === "cash" ? "CASH" : (paymentMode === "upi" ? "UPI" : "BANK_TRANSFER"),
      totalAmount: String(amount || tokenAllocations.reduce((a: number, b: any) => a + Number(b.amount), 0)),
    }).returning();

    // Create the Payment Items (Split)
    const items = [];
    if (tokenAllocations && tokenAllocations.length > 0) {
      for (const alloc of tokenAllocations) {
        if (!alloc.amount || Number(alloc.amount) <= 0) continue;
        const [item] = await db.insert(paymentItems).values({
          receiptId: receipt.id,
          type: "INSTALLMENT",
          amount: String(alloc.amount),
          referenceId: String(alloc.tokenId) // linking to token/membership
        }).returning();
        items.push(item);
      }
    } else {
      // Just a lump sum unallocated
      const [item] = await db.insert(paymentItems).values({
        receiptId: receipt.id,
        type: "INSTALLMENT",
        amount: String(amount),
      }).returning();
      items.push(item);
    }

    res.status(201).json({
      message: "Payment recorded successfully",
      receipt,
      items
    });
  } catch (err) {
    console.error("[POST /collections ERROR]", err);
    res.status(500).json({ error: "Failed to create payment receipt" });
  }
});

export default router;
