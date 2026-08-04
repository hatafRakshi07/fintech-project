import { Router } from "express";
import { db } from "@workspace/db";
import { financialTransactions, customers } from "@workspace/db/schema";
import { desc, eq, and, sql, gte, lte } from "drizzle-orm";

const router = Router();

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
    
    const conditions = [
      sql`${financialTransactions.category} IN ('INSTALLMENT', 'REGISTRATION_FEE', 'PENALTY', 'MISC')`,
      ...buildDateFilter(financialTransactions.createdAt, startDate, endDate)
    ];

    const entries = await db.select({
      id: financialTransactions.id,
      date: financialTransactions.createdAt,
      type: financialTransactions.type,
      category: financialTransactions.category,
      amount: financialTransactions.amount,
      notes: financialTransactions.notes,
      customerName: customers.name,
      customerPhone: customers.mobile
    })
    .from(financialTransactions)
    .leftJoin(customers, eq(financialTransactions.customerId, customers.id))
    .where(and(...conditions))
    .orderBy(desc(financialTransactions.createdAt));

    res.json({ success: true, data: entries });
  } catch (error: any) {
    res.json({ success: true, data: [] });
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
      sql`${financialTransactions.category} IN ('GIFT_PAYMENT', 'SETTLEMENT', 'REFUND')`,
      ...buildDateFilter(financialTransactions.createdAt, startDate, endDate)
    ];

    const entries = await db.select({
      id: financialTransactions.id,
      date: financialTransactions.createdAt,
      type: financialTransactions.type,
      category: financialTransactions.category,
      amount: financialTransactions.amount,
      notes: financialTransactions.notes,
      customerName: customers.name,
      customerPhone: customers.mobile
    })
    .from(financialTransactions)
    .leftJoin(customers, eq(financialTransactions.customerId, customers.id))
    .where(and(...conditions))
    .orderBy(desc(financialTransactions.createdAt));

    res.json({ success: true, data: entries });
  } catch (error: any) {
    res.json({ success: true, data: [] });
  }
});

/**
 * GET /v2/ledger/cashbook
 * Retrieves chronological flow of all ledger transactions to show running balance
 */
router.get("/cashbook", async (req, res) => {
  try {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    
    const conditions = buildDateFilter(financialTransactions.createdAt, startDate, endDate);

    const entries = await db.select({
      id: financialTransactions.id,
      date: financialTransactions.createdAt,
      type: financialTransactions.type,
      category: financialTransactions.category,
      amount: financialTransactions.amount,
      notes: financialTransactions.notes,
      customerName: customers.name
    })
    .from(financialTransactions)
    .leftJoin(customers, eq(financialTransactions.customerId, customers.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(financialTransactions.createdAt);

    let balance = 0;
    const cashbook = entries.map(entry => {
      const amt = parseFloat(entry.amount as any);
      if (entry.type === 'CASH_IN') {
        balance += amt;
      } else {
        balance -= amt;
      }
      return { ...entry, balance };
    });

    res.json({ success: true, data: cashbook.reverse() });
  } catch (error: any) {
    console.error("Ledger cashbook error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export { router as ledgerV2Router };
