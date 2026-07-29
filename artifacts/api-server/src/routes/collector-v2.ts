import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();

// 1. Get all schemes (Bissi) -> maps to committees
router.get("/schemes", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id::text, name, installment_amount::text as "installmentAmount" 
       FROM committees 
       WHERE status = 'active'`
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error("Error fetching schemes:", err);
    res.status(500).json({ error: "Failed to fetch schemes: " + err.message });
  }
});

// 2. Search customers by name, phone, or token number
router.get("/customers/search", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || String(query).length < 2) {
      res.json([]);
      return;
    }

    const searchStr = `%${query}%`;
    const exactStr = String(query).trim();

    // Select distinct customers matching name, phone, or token number
    const result = await pool.query(
      `SELECT DISTINCT c.id::text, c.name, c.mobile as "phone"
       FROM customers c
       LEFT JOIN tokens t ON c.id = t.customer_id
       WHERE c.name ILIKE $1 
          OR c.mobile ILIKE $1 
          OR t.token_number = $2
       LIMIT 20`,
      [searchStr, exactStr]
    );

    res.json(result.rows);
  } catch (err: any) {
    console.error("Error searching customers:", err);
    res.status(500).json({ error: "Failed to search customers: " + err.message });
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

    const custId = parseInt(customerId as string, 10);
    const commId = parseInt(schemeId as string, 10);

    if (isNaN(custId) || isNaN(commId)) {
      res.status(400).json({ error: "Invalid customerId or schemeId" });
      return;
    }

    const result = await pool.query(
      `SELECT 
        cm.id::text as "membershipId",
        cm.committee_id::text as "schemeId",
        cm.customer_id::text as "customerId",
        t.id::text as "tokenId",
        t.token_number::text as "tokenNumber",
        cm.status::text as "status"
      FROM committee_members cm
      LEFT JOIN tokens t ON cm.customer_id = t.customer_id AND cm.committee_id = t.committee_id AND cm.token_number = t.token_number
      WHERE cm.customer_id = $1 AND cm.committee_id = $2`,
      [custId, commId]
    );

    res.json(result.rows);
  } catch (err: any) {
    console.error("Error fetching tokens:", err);
    res.status(500).json({ error: "Failed to fetch tokens: " + err.message });
  }
});

// 4. Submit split payment
router.post("/payments", async (req, res): Promise<void> => {
  const { customerId, paymentMode, screenshotUrl, allocations, collectorId } = req.body;

  if (!customerId || !paymentMode || !allocations || allocations.length === 0) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    const custId = parseInt(customerId, 10);
    const colId = collectorId ? parseInt(collectorId, 10) : 1;

    if (isNaN(custId)) {
      res.status(400).json({ error: "Invalid customer ID" });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const now = new Date();
      const currentMonth = now.getMonth() + 1; // 1-12
      const currentYear = now.getFullYear();

      for (const alloc of allocations) {
        const tokenId = parseInt(alloc.tokenId, 10);
        const amount = parseFloat(alloc.amount);
        if (isNaN(tokenId) || isNaN(amount) || amount <= 0) continue;

        // Fetch token details to get committeeId and token number
        const tokenRes = await client.query(
          "SELECT committee_id, token_number FROM tokens WHERE id = $1",
          [tokenId]
        );
        if (tokenRes.rows.length === 0) continue;
        const { committee_id: committeeId, token_number: tokenNumber } = tokenRes.rows[0];

        // Insert into collections table
        const notes = `Bissi payment via Collector for Token #${tokenNumber}`;
        const receiptNo = `REC-COL-${Date.now().toString().slice(-4)}-${Math.floor(Math.random() * 1000)}`;

        await client.query(
          `INSERT INTO collections (
            customer_id, collector_id, branch_id, committee_id, amount, payment_mode, receipt_number, notes, verification_status, collected_at, created_at
          ) VALUES ($1, $2, 1, $3, $4, $5, $6, $7, 'verified', NOW(), NOW())`,
          [custId, colId, committeeId, amount, paymentMode, receiptNo, notes]
        );

        // Insert into installments table
        await client.query(
          `INSERT INTO installments (
            customer_id, collector_id, token_id, committee_id, month, year, amount, payment_date, payment_mode, receipt_number, remarks, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10, NOW())`,
          [custId, colId, tokenId, committeeId, currentMonth, currentYear, amount, paymentMode, receiptNo, notes]
        );
      }

      await client.query("COMMIT");
      res.status(201).json({ message: "Payment recorded successfully" });
    } catch (txErr) {
      await client.query("ROLLBACK");
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("Payment processing error:", err);
    res.status(500).json({ error: "Payment processing failed: " + err.message });
  }
});

export default router;
