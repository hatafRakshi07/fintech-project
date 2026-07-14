import { Router, type IRouter } from "express";
import { db, customersTable, branchesTable } from "@workspace/db";
import { eq, ilike, or } from "drizzle-orm";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Excel / CSV Import
// Import parses CSV/TSV data sent as JSON array rows.
// For production, use a proper multipart/xlsx parser (xlsx npm package).
// This endpoint accepts pre-parsed rows from the frontend.
// ---------------------------------------------------------------------------

interface ImportRow {
  name?: string;
  mobile?: string;
  alternateMobile?: string;
  email?: string;
  aadhaar?: string;
  pan?: string;
  address?: string;
  city?: string;
  nomineeName?: string;
  nomineeRelation?: string;
  referenceName?: string;
  recoveryNotes?: string;
  status?: string;
  branchCode?: string;
  branchId?: string | number;
  [key: string]: unknown;
}

interface ImportResult {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: Array<{ row: number; reason: string; data: unknown }>;
  log: string[];
}

router.post("/import/customers", async (req, res): Promise<void> => {
  const { rows, branchId: defaultBranchId } = req.body as { rows: ImportRow[]; branchId?: number };

  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "rows array is required" });
    return;
  }

  // Load branches for code → id resolution
  const branches = await db.select().from(branchesTable);
  const branchByCode = Object.fromEntries(branches.map((b) => [b.code.toLowerCase(), b.id]));
  const branchById = Object.fromEntries(branches.map((b) => [String(b.id), b.id]));

  const initialCount = await db.$count(customersTable);

  const result: ImportResult = {
    total: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    log: [],
  };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const name = (row.name ?? row["Name"] ?? row["Full Name"] ?? "").toString().trim();
      const mobile = (row.mobile ?? row["Mobile"] ?? row["Phone"] ?? "").toString().trim();

      if (!name || !mobile) {
        result.failed++;
        result.errors.push({ row: i + 1, reason: "name and mobile are required", data: row });
        continue;
      }

      // Resolve branch
      let resolvedBranchId: number | null = defaultBranchId ?? null;
      if (row.branchCode) {
        resolvedBranchId = branchByCode[(row.branchCode as string).toLowerCase()] ?? resolvedBranchId;
      } else if (row.branchId) {
        resolvedBranchId = branchById[String(row.branchId)] ?? resolvedBranchId;
      }

      if (!resolvedBranchId) {
        result.failed++;
        result.errors.push({ row: i + 1, reason: "Could not resolve branch", data: row });
        continue;
      }

      // Check for duplicate by mobile
      const [existing] = await db
        .select()
        .from(customersTable)
        .where(eq(customersTable.mobile, mobile))
        .limit(1);

      if (existing) {
        // Update existing customer
        await db.update(customersTable).set({
          name,
          email: (row.email as string) || existing.email || undefined,
          address: (row.address as string) || existing.address || undefined,
          city: (row.city as string) || existing.city || undefined,
          aadhaar: (row.aadhaar as string) || existing.aadhaar || undefined,
          pan: (row.pan as string) || existing.pan || undefined,
          alternateMobile: (row.alternateMobile as string) || existing.alternateMobile || undefined,
          nomineeName: (row.nomineeName as string) || existing.nomineeName || undefined,
          nomineeRelation: (row.nomineeRelation as string) || existing.nomineeRelation || undefined,
          referenceName: (row.referenceName as string) || existing.referenceName || undefined,
          recoveryNotes: (row.recoveryNotes as string) || existing.recoveryNotes || undefined,
        }).where(eq(customersTable.id, existing.id));
        result.updated++;
        result.log.push(`Row ${i + 1}: Updated customer ${name} (${mobile})`);
      } else {
        // Generate reference number
        const refNum = `REF${String(initialCount + result.created + 1).padStart(6, "0")}`;

        const validStatuses = ["active", "inactive", "blocked"] as const;
        const statusVal = (row.status as string)?.toLowerCase();
        const status = validStatuses.includes(statusVal as typeof validStatuses[number])
          ? (statusVal as typeof validStatuses[number])
          : "active";

        await db.insert(customersTable).values({
          name,
          mobile,
          referenceNumber: refNum,
          email: (row.email as string) || undefined,
          address: (row.address as string) || undefined,
          city: (row.city as string) || undefined,
          aadhaar: (row.aadhaar as string) || undefined,
          pan: (row.pan as string) || undefined,
          alternateMobile: (row.alternateMobile as string) || undefined,
          nomineeName: (row.nomineeName as string) || undefined,
          nomineeRelation: (row.nomineeRelation as string) || undefined,
          referenceName: (row.referenceName as string) || undefined,
          recoveryNotes: (row.recoveryNotes as string) || undefined,
          branchId: resolvedBranchId,
          status,
        });
        result.created++;
        result.log.push(`Row ${i + 1}: Created customer ${name} (${mobile})`);
      }
    } catch (err) {
      result.failed++;
      result.errors.push({ row: i + 1, reason: err instanceof Error ? err.message : "Unknown error", data: row });
    }
  }

  res.json(result);
});

// Validate import rows without committing — dry run
router.post("/import/customers/validate", async (req, res): Promise<void> => {
  const { rows } = req.body as { rows: ImportRow[] };
  if (!Array.isArray(rows) || rows.length === 0) {
    res.status(400).json({ error: "rows array is required" });
    return;
  }

  const issues: Array<{ row: number; field: string; message: string }> = [];
  const mobileSet = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const name = (row.name ?? row["Name"] ?? "").toString().trim();
    const mobile = (row.mobile ?? row["Mobile"] ?? "").toString().trim();

    if (!name) issues.push({ row: i + 1, field: "name", message: "Name is required" });
    if (!mobile) issues.push({ row: i + 1, field: "mobile", message: "Mobile is required" });
    if (mobile && !/^\d{10}$/.test(mobile.replace(/\D/g, ""))) {
      issues.push({ row: i + 1, field: "mobile", message: "Mobile should be 10 digits" });
    }
    if (mobile && mobileSet.has(mobile)) {
      issues.push({ row: i + 1, field: "mobile", message: `Duplicate mobile in import: ${mobile}` });
    }
    if (mobile) mobileSet.add(mobile);

    if (row.aadhaar && String(row.aadhaar).replace(/\D/g, "").length !== 12) {
      issues.push({ row: i + 1, field: "aadhaar", message: "Aadhaar should be 12 digits" });
    }
  }

  res.json({ valid: issues.length === 0, total: rows.length, issues });
});

export default router;
