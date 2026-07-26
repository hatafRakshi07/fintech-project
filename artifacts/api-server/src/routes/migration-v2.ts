import { Router } from "express";
import multer from "multer";
import * as xlsx from "xlsx";
import { db } from "@workspace/db";
import { customers, memberships, tokens, schemes } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();
const upload = multer({ dest: "uploads/" });

/**
 * POST /api/v2/migration/upload
 * Processes the uploaded Excel file to map and normalize data into Supabase
 */
router.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "No file uploaded" });
  }

  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Parse Excel as JSON
    const data: any[] = xlsx.utils.sheet_to_json(sheet);
    const logs = [];
    const errors = [];
    
    // 1. Ensure we have an active scheme to map this to, or create a mock one.
    // In a real migration, the UI should ask "Which Scheme are we importing to?"
    // For now, we will grab the first ACTIVE scheme.
    const [targetScheme] = await db.select().from(schemes).where(eq(schemes.status, "ACTIVE")).limit(1);
    
    if (!targetScheme) {
      return res.status(400).json({ success: false, error: "No active scheme found in database to migrate data into." });
    }

    // Process rows
    let successCount = 0;
    for (const [index, row] of data.entries()) {
      try {
        const rowNumber = index + 2; // Excel header offset
        
        // Expected columns: Name, Phone, Token, JoiningDate
        const name = row["Name"] || row["name"] || row["Customer Name"];
        const phone = row["Phone"] || row["phone"] || row["Mobile"];
        const tokenNo = row["Token"] || row["token"] || row["Token No"];
        
        if (!name || !phone) {
          errors.push(\`Row \${rowNumber}: Missing Name or Phone\`);
          continue;
        }

        // Check if customer exists
        let customerRecord;
        const existingCustomers = await db.select().from(customers).where(eq(customers.phone, phone.toString()));
        
        if (existingCustomers.length > 0) {
          customerRecord = existingCustomers[0];
          logs.push(\`Row \${rowNumber}: Found existing customer \${name}\`);
        } else {
          const [newCustomer] = await db.insert(customers).values({
            name: name,
            phone: phone.toString(),
          }).returning();
          customerRecord = newCustomer;
          logs.push(\`Row \${rowNumber}: Created new customer \${name}\`);
        }

        // Create Membership
        const [newMembership] = await db.insert(memberships).values({
          customerId: customerRecord.id,
          schemeId: targetScheme.id,
          joiningDate: new Date().toISOString(), // Mocking to today, or parse from Excel
          status: "ACTIVE",
        }).returning();

        // Create Token
        if (tokenNo) {
          await db.insert(tokens).values({
            membershipId: newMembership.id,
            tokenNumber: tokenNo.toString(),
            status: "ACTIVE",
          });
        }
        
        successCount++;
      } catch (err: any) {
        errors.push(\`Row \${index + 2} failed: \${err.message}\`);
      }
    }

    res.json({
      success: true,
      data: {
        totalProcessed: data.length,
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

export default router;
