import { Router } from "express";
import * as xlsx from "xlsx";
import { db } from "@workspace/db";
import { customers, tokens, committees } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

/**
 * POST /api/v2/migration/upload
 * Accepts Excel file as base64-encoded JSON body:
 *   { "fileData": "<base64 string>", "fileName": "data.xlsx" }
 */
router.post("/upload", async (req, res) => {
  try {
    const { fileData, fileName } = req.body as { fileData?: string; fileName?: string };

    if (!fileData) {
      res.status(400).json({ success: false, error: "No file data provided. Send { fileData: '<base64>' }" });
      return;
    }

    const buffer = Buffer.from(fileData, "base64");
    const workbook = xlsx.read(buffer, { type: "buffer" });
    const logs: string[] = [];
    const errors: string[] = [];
    let totalProcessed = 0;
    let successCount = 0;

    const fileTitle = (fileName || "Imported Committee")
      .replace(/\.(xlsx|xls|csv)$/i, "")
      .replace(/[_-]+/g, " ")
      .trim();

    const committeeCache = new Map<string, any>();

    async function getOrCreateCommittee(groupName: string) {
      const cleanName = groupName.trim() || "Default Bissi";
      if (committeeCache.has(cleanName)) {
        return committeeCache.get(cleanName);
      }

      const existing = await db.select().from(committees).where(eq(committees.name, cleanName));
      if (existing.length > 0) {
        committeeCache.set(cleanName, existing[0]);
        return existing[0];
      }

      const codeBase = cleanName.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12) || "COMM";
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const code = `${codeBase.slice(0, 8)}-${randomSuffix}`;

      const [newCommittee] = await db.insert(committees).values({
        organizationId: DEFAULT_ORG_ID,
        name: cleanName,
        code,
        startDate: new Date().toISOString().slice(0, 10),
        monthlyInstallment: "3000.00",
        totalMembers: 500,
        totalMonths: 30,
        status: "ACTIVE",
      }).returning();

      logs.push(`Auto-created new Committee: "${cleanName}" (Code: ${code})`);
      committeeCache.set(cleanName, newCommittee);
      return newCommittee;
    }

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data: any[] = xlsx.utils.sheet_to_json(sheet);
      if (!data || data.length === 0) continue;

      totalProcessed += data.length;

      const sheetGroupName = (sheetName.toLowerCase().startsWith("sheet") || sheetName.toLowerCase().startsWith("table"))
        ? fileTitle
        : sheetName.trim();

      for (const [index, row] of data.entries()) {
        try {
          const rowNumber = index + 2;

          const name = row["Name"] || row["name"] || row["Customer Name"] || row["Customer"] || row["Member Name"] || row["Member"];
          const phone = row["Phone"] || row["phone"] || row["Mobile"] || row["Contact"] || row["Mobile No"] || row["Phone No"];
          const tokenNo = row["Token"] || row["token"] || row["Token No"] || row["TokenNumber"] || row["Seat No"] || row["Slip No"];
          
          const rowGroup = row["Group"] || row["group"] || row["Committee"] || row["committee"] || row["Scheme"] || row["scheme"] || row["Bissi"] || row["Bissi Name"];
          const targetGroupName = rowGroup ? String(rowGroup).trim() : sheetGroupName;

          if (!name || !phone) {
            errors.push(`[${sheetName}] Row ${rowNumber}: Missing Name or Phone`);
            continue;
          }

          const targetCommittee = await getOrCreateCommittee(targetGroupName);
          const cleanPhone = String(phone).replace(/[^\d]/g, "").slice(-10);
          if (!cleanPhone || cleanPhone.length < 10) {
            errors.push(`[${sheetName}] Row ${rowNumber}: Invalid phone number "${phone}" for ${name}`);
            continue;
          }

          let customerRecord;
          const existingCustomers = await db.select().from(customers).where(eq(customers.mobile, cleanPhone));

          if (existingCustomers.length > 0) {
            customerRecord = existingCustomers[0];
          } else {
            const [newCustomer] = await db.insert(customers).values({
              organizationId: DEFAULT_ORG_ID,
              name: String(name).trim(),
              mobile: cleanPhone,
            }).returning();
            customerRecord = newCustomer;
            logs.push(`Created customer: ${name} (${cleanPhone})`);
          }

          if (tokenNo) {
            const cleanToken = String(tokenNo).trim();
            const normalizedToken = parseInt(cleanToken.replace(/[^0-9]/g, "") || "0", 10);
            
            const existingTokens = await db
              .select()
              .from(tokens)
              .where(eq(tokens.committeeId, targetCommittee.id));

            const hasToken = existingTokens.some(t => t.rawTokenNumber === cleanToken);
            if (!hasToken) {
              await db.insert(tokens).values({
                organizationId: DEFAULT_ORG_ID,
                committeeId: targetCommittee.id,
                customerId: customerRecord.id,
                rawTokenNumber: cleanToken,
                normalizedTokenNumber: normalizedToken,
                status: "ACTIVE",
              });
            }
          }

          successCount++;
        } catch (err: any) {
          errors.push(`[${sheetName}] Row ${index + 2} failed: ${err.message}`);
        }
      }
    }

    res.json({
      success: true,
      data: {
        totalProcessed,
        successCount,
        errorCount: errors.length,
        logs,
        errors
      }
    });

  } catch (error: any) {
    console.error("Migration error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export { router as migrationV2Router };
