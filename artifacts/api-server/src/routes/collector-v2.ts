import { Router } from "express";
import { db, schemes, customers, memberships, tokens, paymentReceipts, paymentItems } from "@workspace/db";
import { eq, and, sql, inArray } from "drizzle-orm";

const router = Router();

function genReceipt(): string {
  return `RCP${Date.now()}`;
}

// 1. Get all schemes (Bissi)
router.get("/schemes", async (req, res) => {
  try {
    const data = await db.select().from(schemes);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch schemes" });
  }
});

// 2. Search customers by name or phone
router.get("/customers/search", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || String(query).length < 2) {
      res.json([]);
      return;
    }
    const data = await db.select()
      .from(customers)
      .where(sql`${customers.name} ILIKE ${'%' + query + '%'} OR ${customers.phone} ILIKE ${'%' + query + '%'}`)
      .limit(20);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Failed to search customers" });
  }
});

// 3. Get customer tokens/memberships for a specific scheme
router.get("/tokens", async (req, res) => {
  try {
    const { customerId, schemeId } = req.query;
    if (!customerId || !schemeId) {
       res.status(400).json({ error: "customerId and schemeId required" });
       return;
    }

    const mems = await db.select({
      membershipId: memberships.id,
      schemeId: memberships.schemeId,
      customerId: memberships.customerId,
      tokenId: tokens.id,
      tokenNumber: tokens.tokenNumber,
      status: memberships.status
    })
    .from(memberships)
    .innerJoin(tokens, eq(tokens.membershipId, memberships.id))
    .where(and(
      eq(memberships.customerId, String(customerId)),
      eq(memberships.schemeId, String(schemeId))
    ));
    
    res.json(mems);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tokens" });
  }
});

// 4. Submit split payment
router.post("/payments", async (req, res) => {
  const { customerId, paymentMode, screenshotUrl, allocations } = req.body;
  // allocations: { tokenId, amount }[]

  if (!customerId || !paymentMode || !allocations || allocations.length === 0) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    const totalAmount = allocations.reduce((sum: number, alloc: any) => sum + Number(alloc.amount), 0);

    const [receipt] = await db.insert(paymentReceipts).values({
      receiptNo: genReceipt(),
      customerId: String(customerId),
      paymentMethod: paymentMode === "cash" ? "CASH" : (paymentMode === "upi" ? "UPI" : "BANK_TRANSFER"),
      totalAmount: String(totalAmount),
    }).returning();

    const items = [];
    for (const alloc of allocations) {
      if (Number(alloc.amount) <= 0) continue;
      const [item] = await db.insert(paymentItems).values({
        receiptId: receipt.id,
        type: "INSTALLMENT",
        amount: String(alloc.amount),
        referenceId: String(alloc.tokenId),
      }).returning();
      items.push(item);
    }

    res.status(201).json({ message: "Payment successful", receipt, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Payment processing failed" });
  }
});

export default router;
