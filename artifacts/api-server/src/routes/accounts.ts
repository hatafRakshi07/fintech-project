import { Router, type IRouter } from "express";
import { db, bankAccountsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/accounts - List all bank/cash accounts (autoseed default accounts if empty)
router.get("/accounts", async (req, res): Promise<void> => {
  try {
    let accounts = await db.select().from(bankAccountsTable).orderBy(desc(bankAccountsTable.createdAt));

    if (accounts.length === 0) {
      // Seed initial default accounts
      const defaultAccounts = [
        {
          accountName: "Main Cash Box / Field Counter",
          accountNumber: "CASH-MAIN-01",
          bankName: "Office Cash Counter",
          accountType: "cash" as const,
          isActive: true,
          notes: "Primary cash counter for daily field collections",
        },
        {
          accountName: "HDFC Main Current A/C",
          accountNumber: "50200088991122",
          bankName: "HDFC Bank",
          ifscCode: "HDFC0001234",
          accountType: "bank" as const,
          isActive: true,
          notes: "Primary company bank account for bank & cheque transfers",
        },
        {
          accountName: "PhonePe / GPay Business UPI QR",
          accountNumber: "ska.fintech@upi",
          bankName: "UPI QR Account",
          accountType: "upi" as const,
          isActive: true,
          notes: "Official UPI QR account for digital collections",
        },
      ];

      await db.insert(bankAccountsTable).values(defaultAccounts);
      accounts = await db.select().from(bankAccountsTable).orderBy(desc(bankAccountsTable.createdAt));
    }

    res.json(accounts);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch accounts" });
  }
});

// POST /api/accounts - Create new bank or cash account
router.post("/accounts", async (req, res): Promise<void> => {
  if (req.userRole === "customer" || req.userRole === "collector") {
    res.status(403).json({ error: "Forbidden: Only admins & managers can manage bank accounts." });
    return;
  }

  const { accountName, accountNumber, bankName, ifscCode, accountType, branchId, notes } = req.body;
  if (!accountName) {
    res.status(400).json({ error: "accountName is required" });
    return;
  }

  try {
    const [acc] = await db
      .insert(bankAccountsTable)
      .values({
        accountName,
        accountNumber: accountNumber || null,
        bankName: bankName || null,
        ifscCode: ifscCode || null,
        accountType: accountType || "bank",
        branchId: branchId ? parseInt(String(branchId), 10) : null,
        notes: notes || null,
        isActive: true,
      })
      .returning();

    res.status(201).json(acc);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create account" });
  }
});

// PUT /api/accounts/:id - Update bank account details or active status
router.put("/accounts/:id", async (req, res): Promise<void> => {
  if (req.userRole === "customer" || req.userRole === "collector") {
    res.status(403).json({ error: "Forbidden: Only admins & managers can manage bank accounts." });
    return;
  }

  const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
  const { accountName, accountNumber, bankName, ifscCode, accountType, isActive, notes } = req.body;

  try {
    const [acc] = await db
      .update(bankAccountsTable)
      .set({
        ...(accountName !== undefined && { accountName }),
        ...(accountNumber !== undefined && { accountNumber }),
        ...(bankName !== undefined && { bankName }),
        ...(ifscCode !== undefined && { ifscCode }),
        ...(accountType !== undefined && { accountType }),
        ...(isActive !== undefined && { isActive }),
        ...(notes !== undefined && { notes }),
      })
      .where(eq(bankAccountsTable.id, id))
      .returning();

    if (!acc) {
      res.status(404).json({ error: "Account not found" });
      return;
    }

    res.json(acc);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to update account" });
  }
});

export default router;
