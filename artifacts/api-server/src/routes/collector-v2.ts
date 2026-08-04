import { Router } from "express";
import { pool } from "@workspace/db";

const router = Router();
const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

// 1. Get all committees
router.get("/schemes", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id::text, name, COALESCE(monthly_installment, installment_amount, 3000)::text as "installmentAmount" 
       FROM committees 
       WHERE status = 'ACTIVE'`
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error("Error fetching committees:", err);
    res.status(500).json({ error: "Failed to fetch committees: " + err.message });
  }
});

// 2. Search customers by name, mobile, or display_token
router.get("/customers/search", async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || String(query).length < 1) {
      res.json([]);
      return;
    }

    const searchStr = `%${query}%`;
    const exactStr = String(query).trim();

    const sql = `
      SELECT DISTINCT 
        c.id::text, 
        c.name, 
        c.mobile as "phone",
        t.display_token as "tokenNumber",
        comm.name as "schemeName"
      FROM customers c
      LEFT JOIN tokens t ON t.customer_id = c.id
      LEFT JOIN committees comm ON comm.id = t.committee_id
      WHERE (
        c.name ILIKE $1 
        OR c.mobile ILIKE $1 
        OR t.raw_token_number ILIKE $1
        OR t.raw_token_number = $2
      )
      AND c.deleted_at IS NULL
      ORDER BY c.name ASC LIMIT 30
    `;

    const result = await pool.query(sql, [searchStr, exactStr]);
    res.json(result.rows);
  } catch (err: any) {
    console.error("Error searching customers:", err);
    res.status(500).json({ error: "Failed to search customers: " + err.message });
  }
});

// 3. Get customer tokens
router.get("/tokens", async (req, res) => {
  try {
    const { customerId } = req.query;
    if (!customerId) {
      res.status(400).json({ error: "customerId is required" });
      return;
    }

    const query = `
      SELECT 
        t.id::text as "tokenId",
        t.committee_id::text as "schemeId",
        t.customer_id::text as "customerId",
        t.display_token::text as "tokenNumber",
        t.status::text as "status"
      FROM tokens t
      WHERE (t.customer_id::text = $1 OR t.customer_id IN (SELECT id FROM customers WHERE id::text = $1 OR mobile = $1)) AND t.deleted_at IS NULL
    `;

    const result = await pool.query(query, [String(customerId)]);
    res.json(result.rows);
  } catch (err: any) {
    console.error("Error fetching tokens:", err);
    res.status(500).json({ error: "Failed to fetch tokens: " + err.message });
  }
});

// 4. Submit installment payment
router.post("/payments", async (req, res): Promise<void> => {
  const { customerId, paymentMode, allocations } = req.body;

  if (!customerId || !paymentMode || !allocations || allocations.length === 0) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      for (const alloc of allocations) {
        const tokenId = alloc.tokenId;
        const amount = parseFloat(alloc.amount);
        if (!tokenId || isNaN(amount) || amount <= 0) continue;

        // Fetch token and first open committee month
        const tokenRes = await client.query(
          "SELECT committee_id FROM tokens WHERE id = $1::uuid",
          [tokenId]
        );
        if (tokenRes.rows.length === 0) continue;
        const committeeId = tokenRes.rows[0].committee_id;

        const monthRes = await client.query(
          "SELECT id FROM committee_months WHERE committee_id = $1::uuid ORDER BY month_number ASC LIMIT 1",
          [committeeId]
        );
        if (monthRes.rows.length === 0) continue;
        const committeeMonthId = monthRes.rows[0].id;

        const receiptNo = `REC-COL-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

        await client.query(
          `INSERT INTO installments (
            organization_id, committee_month_id, token_id, receipt_number, expected_amount, paid_amount, payment_date, payment_mode
          ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, CURRENT_DATE, $7::payment_mode_enum)`,
          [DEFAULT_ORG_ID, committeeMonthId, tokenId, receiptNo, amount, amount, paymentMode.toUpperCase()]
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
