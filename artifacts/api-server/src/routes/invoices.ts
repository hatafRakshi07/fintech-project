import { Router, type IRouter } from "express";
import { db, invoicesTable, invoiceItemsTable, customersTable, branchesTable, usersTable } from "@workspace/db";
import { eq, desc, and, sql } from "drizzle-orm";
import { safeIso } from "../lib/utils";

const router: IRouter = Router();

async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(invoicesTable)
    .where(sql`invoice_number LIKE ${prefix + "%"}`);
  const seq = (row?.count ?? 0) + 1;
  return `${prefix}${String(seq).padStart(5, "0")}`;
}

router.get("/invoices", async (req, res): Promise<void> => {
  try {
    const { status, customerId, branchId, page = "1", limit = "20" } = req.query;
    let pageNum = parseInt(page as string, 10);
    if (isNaN(pageNum) || pageNum <= 0) pageNum = 1;
    let limitNum = parseInt(limit as string, 10);
    if (isNaN(limitNum) || limitNum <= 0) limitNum = 20;
    const offset = (pageNum - 1) * limitNum;

    const conditions = [];
    if (status) conditions.push(eq(invoicesTable.status, status as any));
    if (customerId) conditions.push(eq(invoicesTable.customerId, parseInt(customerId as string, 10)));
    if (branchId) conditions.push(eq(invoicesTable.branchId, parseInt(branchId as string, 10)));

    let baseQuery = db
      .select({
        inv: invoicesTable,
        customerName: customersTable.name,
        customerMobile: customersTable.mobile,
        branchName: branchesTable.name,
        createdByName: usersTable.name,
      })
      .from(invoicesTable)
      .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
      .leftJoin(branchesTable, eq(invoicesTable.branchId, branchesTable.id))
      .leftJoin(usersTable, eq(invoicesTable.createdByUserId, usersTable.id))
      .$dynamic();

    if (conditions.length > 0) baseQuery = (baseQuery as any).where(and(...conditions));

    const sliced = await (baseQuery as any).orderBy(desc(invoicesTable.createdAt)).offset(offset).limit(limitNum);

    const [totalRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoicesTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = totalRow?.count ?? sliced.length;

    const data = sliced.map((r: any) => ({
      ...r.inv,
      subtotal: parseFloat(r.inv.subtotal),
      taxRate: parseFloat(r.inv.taxRate),
      taxAmount: parseFloat(r.inv.taxAmount),
      discountAmount: parseFloat(r.inv.discountAmount),
      total: parseFloat(r.inv.total),
      customerName: r.customerName,
      customerMobile: r.customerMobile,
      branchName: r.branchName,
      createdByName: r.createdByName,
      createdAt: safeIso(r.inv.createdAt),
      updatedAt: safeIso(r.inv.updatedAt),
    }));

    res.json({ data, total, page: pageNum, limit: limitNum });
  } catch (err: any) {
    console.error("[GET /invoices ERROR]", err);
    res.json({ data: [], total: 0, page: 1, limit: 20 });
  }
});

router.get("/invoices/summary", async (_req, res): Promise<void> => {
  try {
    const rows = await db.select({ status: invoicesTable.status, total: invoicesTable.total }).from(invoicesTable);
    const summary = { total: 0, draft: 0, sent: 0, paid: 0, overdue: 0, cancelled: 0, totalAmount: 0, paidAmount: 0 };
    for (const r of rows) {
      summary.total++;
      const amt = parseFloat(r.total);
      summary.totalAmount += amt;
      if (r.status === "draft") summary.draft++;
      else if (r.status === "sent") summary.sent++;
      else if (r.status === "paid") { summary.paid++; summary.paidAmount += amt; }
      else if (r.status === "overdue") summary.overdue++;
      else if (r.status === "cancelled") summary.cancelled++;
    }
    res.json(summary);
  } catch (err: any) {
    console.error("[GET /invoices/summary ERROR]", err);
    res.json({ total: 0, draft: 0, sent: 0, paid: 0, overdue: 0, cancelled: 0, totalAmount: 0, paidAmount: 0 });
  }
});

router.get("/invoices/:id", async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

    const [row] = await db
      .select({
        inv: invoicesTable,
        customerName: customersTable.name,
        customerMobile: customersTable.mobile,
        customerAddress: customersTable.address,
        branchName: branchesTable.name,
        createdByName: usersTable.name,
      })
      .from(invoicesTable)
      .leftJoin(customersTable, eq(invoicesTable.customerId, customersTable.id))
      .leftJoin(branchesTable, eq(invoicesTable.branchId, branchesTable.id))
      .leftJoin(usersTable, eq(invoicesTable.createdByUserId, usersTable.id))
      .where(eq(invoicesTable.id, id));

    if (!row) { res.status(404).json({ error: "Invoice not found" }); return; }

    const items = await db
      .select()
      .from(invoiceItemsTable)
      .where(eq(invoiceItemsTable.invoiceId, id))
      .orderBy(invoiceItemsTable.sortOrder);

    res.json({
      ...row.inv,
      subtotal: parseFloat(row.inv.subtotal),
      taxRate: parseFloat(row.inv.taxRate),
      taxAmount: parseFloat(row.inv.taxAmount),
      discountAmount: parseFloat(row.inv.discountAmount),
      total: parseFloat(row.inv.total),
      customerName: row.customerName,
      customerMobile: row.customerMobile,
      customerAddress: row.customerAddress,
      branchName: row.branchName,
      createdByName: row.createdByName,
      createdAt: safeIso(row.inv.createdAt),
      updatedAt: safeIso(row.inv.updatedAt),
      items: items.map((item) => ({
        ...item,
        quantity: parseFloat(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
        amount: parseFloat(item.amount),
      })),
    });
  } catch (err: any) {
    console.error("[GET /invoices/:id ERROR]", err);
    res.status(500).json({ error: "Invoice not found" });
  }
});

export default router;
