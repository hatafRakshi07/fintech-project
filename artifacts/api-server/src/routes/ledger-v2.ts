import { Router } from "express";
import { db } from "@workspace/db";
import { ledgerTransactions, customers, paymentReceipts, paymentItems } from "@workspace/db/schema";
import { desc, eq, and, sql, gte, lte } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const router = Router();

// In a real app we'd use requireAuth, but we bypassed it for demo
// router.use(requireAuth);

/**
 * Helper to build common date filters
 */
const buildDateFilter = (col: any, startDate?: string, endDate?: string) => {
  const conditions = [];
  if (startDate) conditions.push(gte(col, new Date(startDate)));
  if (endDate) {
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    conditions.push(lte(col, end));
  }
  return conditions;
};

/**
 * GET /v2/ledger/sales
 * Retrieves sales-related ledger entries (Installments, Registration, Penalties)
 */
router.get("/sales", async (req, res) => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    
    // We can query ledgerTransactions where category in ('INSTALLMENT', 'REGISTRATION_FEE', 'PENALTY', 'MISC')
    const conditions = [
      sql`${ledgerTransactions.category} IN ('INSTALLMENT', 'REGISTRATION_FEE', 'PENALTY', 'MISC')`,
      ...buildDateFilter(ledgerTransactions.createdAt, startDate, endDate)
    ];

    const entries = await db.select({
      id: ledgerTransactions.id,
      date: ledgerTransactions.createdAt,
      type: ledgerTransactions.type,
      category: ledgerTransactions.category,
      amount: ledgerTransactions.amount,
      notes: ledgerTransactions.notes,
      customerName: customers.name,
      customerPhone: customers.phone
    })
    .from(ledgerTransactions)
    .leftJoin(customers, eq(ledgerTransactions.customerId, customers.id))
    .where(and(...conditions))
    .orderBy(desc(ledgerTransactions.createdAt));

    res.json({ success: true, data: entries });
  } catch (error: any) {
    console.error("Ledger sales error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /v2/ledger/purchase
 * Retrieves purchase-related ledger entries (Gifts, Settlements, Refunds)
 */
router.get("/purchase", async (req, res) => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    
    const conditions = [
      sql`${ledgerTransactions.category} IN ('GIFT_PAYMENT', 'SETTLEMENT', 'REFUND')`,
      ...buildDateFilter(ledgerTransactions.createdAt, startDate, endDate)
    ];

    const entries = await db.select({
      id: ledgerTransactions.id,
      date: ledgerTransactions.createdAt,
      type: ledgerTransactions.type,
      category: ledgerTransactions.category,
      amount: ledgerTransactions.amount,
      notes: ledgerTransactions.notes,
      customerName: customers.name,
      customerPhone: customers.phone
    })
    .from(ledgerTransactions)
    .leftJoin(customers, eq(ledgerTransactions.customerId, customers.id))
    .where(and(...conditions))
    .orderBy(desc(ledgerTransactions.createdAt));

    res.json({ success: true, data: entries });
  } catch (error: any) {
    console.error("Ledger purchase error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /v2/ledger/cashbook
 * Retrieves chronological flow of all ledger transactions to show running balance
 */
router.get("/cashbook", async (req, res) => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    
    // We fetch everything inside date range
    const conditions = buildDateFilter(ledgerTransactions.createdAt, startDate, endDate);

    const entries = await db.select({
      id: ledgerTransactions.id,
      date: ledgerTransactions.createdAt,
      type: ledgerTransactions.type,
      category: ledgerTransactions.category,
      amount: ledgerTransactions.amount,
      notes: ledgerTransactions.notes,
      customerName: customers.name
    })
    .from(ledgerTransactions)
    .leftJoin(customers, eq(ledgerTransactions.customerId, customers.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(ledgerTransactions.createdAt); // Order ascending for chronological cashbook!

    // Calculate running balance
    let balance = 0;
    const cashbook = entries.map(entry => {
      const amt = parseFloat(entry.amount as any);
      if (entry.type === 'CREDIT') {
        balance += amt; // Inflow
      } else {
        balance -= amt; // Outflow
      }
      return { ...entry, balance };
    });

    // We can reverse it at the end to show newest on top
    res.json({ success: true, data: cashbook.reverse() });
  } catch (error: any) {
    console.error("Ledger cashbook error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export { router as ledgerV2Router };
