import { Router, type IRouter } from "express";
import {
  db,
  customersTable,
  branchesTable,
  tokensTable,
  loansTable,
  collectionsTable,
  committeesTable,
} from "@workspace/db";
import { ilike, or, sql, eq } from "drizzle-orm";

const router: IRouter = Router();

// GET /search/global — Multi-field search across Customer Name, Customer ID, Mobile, Token Number, Loan Number, Receipt Number, Reference Name
router.get("/search/global", async (req, res): Promise<void> => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== "string" || q.trim().length === 0) {
      res.json({ results: [] });
      return;
    }

    const query = q.trim();
    const cleanNum = query.replace(/\D/g, "");
    const searchPattern = `%${query}%`;

    // 1. Direct Customer Match (Name, Mobile, Reference Number, Reference Name)
    const directCustomers = await db
      .select({
        customer: customersTable,
        branchName: branchesTable.name,
      })
      .from(customersTable)
      .leftJoin(branchesTable, eq(customersTable.branchId, branchesTable.id))
      .where(
        or(
          ilike(customersTable.name, searchPattern),
          ilike(customersTable.referenceNumber, searchPattern),
          ilike(customersTable.referenceName, searchPattern),
          cleanNum.length >= 3 ? ilike(customersTable.mobile, `%${cleanNum}%`) : sql`false`
        )
      )
      .limit(15);

    // 2. Token Number Match
    const tokenMatches = await db
      .select({
        customerId: tokensTable.customerId,
        tokenNumber: tokensTable.tokenNumber,
        committeeName: committeesTable.name,
        customerName: customersTable.name,
        customerMobile: customersTable.mobile,
      })
      .from(tokensTable)
      .innerJoin(customersTable, eq(tokensTable.customerId, customersTable.id))
      .leftJoin(committeesTable, eq(tokensTable.committeeId, committeesTable.id))
      .where(ilike(tokensTable.tokenNumber, searchPattern))
      .limit(10);

    // 3. Loan Number / Customer Loan Match
    const loanMatches = await db
      .select({
        customerId: loansTable.customerId,
        loanId: loansTable.id,
        principalAmount: loansTable.principalAmount,
        status: loansTable.status,
        customerName: customersTable.name,
      })
      .from(loansTable)
      .innerJoin(customersTable, eq(loansTable.customerId, customersTable.id))
      .where(
        or(
          cleanNum ? eq(loansTable.id, parseInt(cleanNum, 10)) : sql`false`,
          ilike(loansTable.status, searchPattern)
        )
      )
      .limit(10);

    // 4. Receipt Number Match
    const receiptMatches = await db
      .select({
        customerId: collectionsTable.customerId,
        receiptNumber: collectionsTable.receiptNumber,
        amount: collectionsTable.amount,
        customerName: customersTable.name,
      })
      .from(collectionsTable)
      .innerJoin(customersTable, eq(collectionsTable.customerId, customersTable.id))
      .where(ilike(collectionsTable.receiptNumber, searchPattern))
      .limit(10);

    // Build unified map of matched customer profiles
    const customerMap = new Map<number, any>();

    for (const c of directCustomers) {
      if (!customerMap.has(c.customer.id)) {
        customerMap.set(c.customer.id, {
          id: c.customer.id,
          name: c.customer.name,
          mobile: c.customer.mobile,
          referenceNumber: c.customer.referenceNumber,
          branchName: c.branchName,
          matchedBy: "name_or_mobile",
          details: `Ref: ${c.customer.referenceNumber}`,
        });
      }
    }

    for (const t of tokenMatches) {
      if (!customerMap.has(t.customerId)) {
        customerMap.set(t.customerId, {
          id: t.customerId,
          name: t.customerName,
          mobile: t.customerMobile,
          referenceNumber: `CUST-${t.customerId}`,
          matchedBy: "token",
          details: `Token #${t.tokenNumber} in ${t.committeeName || "Scheme"}`,
        });
      }
    }

    for (const l of loanMatches) {
      if (!customerMap.has(l.customerId)) {
        customerMap.set(l.customerId, {
          id: l.customerId,
          name: l.customerName,
          referenceNumber: `CUST-${l.customerId}`,
          matchedBy: "loan",
          details: `Loan #${l.loanId} (₹${parseFloat(l.principalAmount || "0").toLocaleString()})`,
        });
      }
    }

    for (const r of receiptMatches) {
      if (!customerMap.has(r.customerId)) {
        customerMap.set(r.customerId, {
          id: r.customerId,
          name: r.customerName,
          referenceNumber: `CUST-${r.customerId}`,
          matchedBy: "receipt",
          details: `Receipt ${r.receiptNumber} (₹${parseFloat(r.amount || "0").toLocaleString()})`,
        });
      }
    }

    // Fetch scheme memberships for matched customers (to satisfy requirement #5: Scheme selection when customer belongs to multiple Bissi)
    const results = await Promise.all(
      Array.from(customerMap.values()).map(async (item) => {
        const schemes = await db
          .select({
            committeeId: committeesTable.id,
            committeeName: committeesTable.name,
            committeeType: committeesTable.type,
          })
          .from(tokensTable)
          .leftJoin(committeesTable, eq(tokensTable.committeeId, committeesTable.id))
          .where(eq(tokensTable.customerId, item.id));

        const uniqueSchemes = Object.values(
          schemes.reduce((acc: Record<number, any>, s) => {
            if (s.committeeId && !acc[s.committeeId]) {
              acc[s.committeeId] = { id: s.committeeId, name: s.committeeName, type: s.committeeType };
            }
            return acc;
          }, {})
        );

        return {
          ...item,
          schemes: uniqueSchemes,
          hasMultipleSchemes: uniqueSchemes.length > 1,
        };
      })
    );

    res.json({ results });
  } catch (err: any) {
    console.error("[GLOBAL SEARCH ERROR]", err);
    res.status(500).json({ error: "Failed to execute global search" });
  }
});

export default router;
