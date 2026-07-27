import { Router } from "express";
import * as xlsx from "xlsx";
import { db } from "@workspace/db";
import { customers, memberships, tokens, schemes } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

/**
 * POST /api/v2/migration/upload
 * Accepts Excel file as base64-encoded JSON body:
 *   { "fileData": "<base64 string>", "fileName": "data.xlsx" }
 *
 * This avoids needing multer (which has CJS/pnpm bundling issues on Render).
 */
router.post("/upload", async (req, res) => {
  try {
    const { fileData, fileName } = req.body as { fileData?: string; fileName?: string };

    if (!fileData) {
      res.status(400).json({ success: false, error: "No file data provided. Send { fileData: '<base64>' }" });
      return;
    }

    // Decode base64 to buffer and read as workbook
    const buffer = Buffer.from(fileData, "base64");
    const workbook = xlsx.read(buffer, { type: "buffer" });
    const logs: string[] = [];
    const errors: string[] = [];
    let totalProcessed = 0;
    let successCount = 0;

    // Clean file title for fallback scheme name e.g. "Sawariya_Seth.xlsx" -> "Sawariya Seth"
    const fileTitle = (fileName || "Imported Scheme")
      .replace(/\.(xlsx|xls|csv)$/i, "")
      .replace(/[_-]+/g, " ")
      .trim();

    // Cache of created/found schemes by name
    const schemeCache = new Map<string, any>();

    async function getOrCreateScheme(groupName: string) {
      const cleanName = groupName.trim() || "Default Bissi";
      if (schemeCache.has(cleanName)) {
        return schemeCache.get(cleanName);
      }

      // Check DB for existing scheme by name
      const existing = await db.select().from(schemes).where(eq(schemes.name, cleanName));
      if (existing.length > 0) {
        schemeCache.set(cleanName, existing[0]);
        return existing[0];
      }

      // Generate clean unique code
      const codeBase = cleanName.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 12) || "SCH";
      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const code = `${codeBase.slice(0, 8)}-${randomSuffix}`;

      // Detect draw day from name e.g. "5 date" or "15 date"
      const dateMatch = cleanName.match(/(\d{1,2})\s*(st|nd|rd|th)?\s*date/i) || cleanName.match(/date\s*(\d{1,2})/i);
      const drawDay = dateMatch ? Math.min(Math.max(parseInt(dateMatch[1], 10), 1), 28) : 10;

      const [newScheme] = await db.insert(schemes).values({
        name: cleanName,
        code,
        drawDay,
        drawTime: "12:00:00",
        startDate: new Date().toISOString().slice(0, 10),
        monthlyInstallment: "5000",
        durationMonths: 20,
        status: "ACTIVE",
      }).returning();

      logs.push(`Auto-created new Bissi Group/Scheme: "${cleanName}" (Code: ${code})`);
      schemeCache.set(cleanName, newScheme);
      return newScheme;
    }

    // Process all sheets in the workbook
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const data: any[] = xlsx.utils.sheet_to_json(sheet);
      if (!data || data.length === 0) continue;

      totalProcessed += data.length;

      // Determine default group name for this sheet
      const sheetGroupName = (sheetName.toLowerCase().startsWith("sheet") || sheetName.toLowerCase().startsWith("table"))
        ? fileTitle
        : sheetName.trim();

      for (const [index, row] of data.entries()) {
        try {
          const rowNumber = index + 2;

          // Expected columns with multiple aliases
          const name = row["Name"] || row["name"] || row["Customer Name"] || row["Customer"] || row["Member Name"] || row["Member"];
          const phone = row["Phone"] || row["phone"] || row["Mobile"] || row["Contact"] || row["Mobile No"] || row["Phone No"];
          const tokenNo = row["Token"] || row["token"] || row["Token No"] || row["TokenNumber"] || row["Seat No"] || row["Slip No"];
          
          // Custom group name column in row if present
          const rowGroup = row["Group"] || row["group"] || row["Committee"] || row["committee"] || row["Scheme"] || row["scheme"] || row["Bissi"] || row["Bissi Name"];
          const targetGroupName = rowGroup ? String(rowGroup).trim() : sheetGroupName;

          if (!name || !phone) {
            errors.push(`[${sheetName}] Row ${rowNumber}: Missing Name or Phone`);
            continue;
          }

          const targetScheme = await getOrCreateScheme(targetGroupName);
          const cleanPhone = String(phone).replace(/[^\d]/g, "").slice(-10);
          if (!cleanPhone || cleanPhone.length < 10) {
            errors.push(`[${sheetName}] Row ${rowNumber}: Invalid phone number "${phone}" for ${name}`);
            continue;
          }

          // Check if customer exists
          let customerRecord;
          const existingCustomers = await db.select().from(customers).where(eq(customers.phone, cleanPhone));

          if (existingCustomers.length > 0) {
            customerRecord = existingCustomers[0];
          } else {
            const [newCustomer] = await db.insert(customers).values({
              name: String(name).trim(),
              phone: cleanPhone,
            }).returning();
            customerRecord = newCustomer;
            logs.push(`Created customer: ${name} (${cleanPhone})`);
          }

          // Check if membership already exists in this scheme
          const existingMemberships = await db
            .select()
            .from(memberships)
            .where(eq(memberships.customerId, customerRecord.id));

          let membershipRecord = existingMemberships.find(m => m.schemeId === targetScheme.id);

          if (!membershipRecord) {
            const [newMembership] = await db.insert(memberships).values({
              customerId: customerRecord.id,
              schemeId: targetScheme.id,
              joiningDate: new Date().toISOString(),
              status: "ACTIVE",
            }).returning();
            membershipRecord = newMembership;
          }

          // Create Token if present
          if (tokenNo) {
            const cleanToken = String(tokenNo).trim();
            // Check if token already exists for this membership
            const existingTokens = await db
              .select()
              .from(tokens)
              .where(eq(tokens.membershipId, membershipRecord.id));

            const hasToken = existingTokens.some(t => t.tokenNumber === cleanToken);
            if (!hasToken) {
              await db.insert(tokens).values({
                membershipId: membershipRecord.id,
                tokenNumber: cleanToken,
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

