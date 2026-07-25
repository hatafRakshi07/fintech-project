import { Router, type IRouter, type Request, type Response } from "express";
import { db, kycVerificationsTable, usersTable, customersTable, collectorsTable, agentsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router: IRouter = Router();

/**
 * GET /kyc/me - Fetch current user's KYC verification status and details
 */
router.get("/kyc/me", async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const [kyc] = await db
      .select()
      .from(kycVerificationsTable)
      .where(eq(kycVerificationsTable.userId, user.id))
      .orderBy(desc(kycVerificationsTable.createdAt))
      .limit(1);

    res.json({
      kyc: kyc || null,
      userRole: user.role,
      status: kyc ? kyc.status : "not_submitted",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch KYC details" });
  }
});

/**
 * POST /kyc/submit - Submit or update KYC verification application
 */
router.post("/kyc/submit", async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const {
      aadhaarNumber,
      panNumber,
      aadhaarFrontUrl,
      aadhaarBackUrl,
      panCardUrl,
      selfieUrl,
      bankAccountNo,
      bankIfsc,
      bankName,
    } = req.body;

    const userKycRole = user.role === "customer" ? "customer" : user.role === "collector" ? "collector" : "agent";
    const refId = user.customerId || user.collectorId || user.agentId || null;

    // Check if record exists
    const [existing] = await db
      .select()
      .from(kycVerificationsTable)
      .where(eq(kycVerificationsTable.userId, user.id))
      .orderBy(desc(kycVerificationsTable.createdAt))
      .limit(1);

    let kycRecord;
    if (existing) {
      const [updated] = await db
        .update(kycVerificationsTable)
        .set({
          aadhaarNumber: aadhaarNumber || existing.aadhaarNumber,
          panNumber: panNumber || existing.panNumber,
          aadhaarFrontUrl: aadhaarFrontUrl || existing.aadhaarFrontUrl,
          aadhaarBackUrl: aadhaarBackUrl || existing.aadhaarBackUrl,
          panCardUrl: panCardUrl || existing.panCardUrl,
          selfieUrl: selfieUrl || existing.selfieUrl,
          bankAccountNo: bankAccountNo || existing.bankAccountNo,
          bankIfsc: bankIfsc || existing.bankIfsc,
          bankName: bankName || existing.bankName,
          status: "pending",
          rejectionReason: null,
          submittedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(kycVerificationsTable.id, existing.id))
        .returning();
      kycRecord = updated;
    } else {
      const [created] = await db
        .insert(kycVerificationsTable)
        .values({
          userId: user.id,
          userRole: userKycRole,
          referenceId: refId,
          aadhaarNumber,
          panNumber,
          aadhaarFrontUrl,
          aadhaarBackUrl,
          panCardUrl,
          selfieUrl,
          bankAccountNo,
          bankIfsc,
          bankName,
          status: "pending",
          submittedAt: new Date(),
        })
        .returning();
      kycRecord = created;
    }

    res.json({ message: "KYC submitted successfully", kyc: kycRecord });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to submit KYC" });
  }
});

/**
 * GET /kyc/pending - Admin route: List all pending / under_review KYC requests
 */
router.get("/kyc/pending", async (req: Request, res: Response): Promise<void> => {
  try {
    const list = await db
      .select({
        kyc: kycVerificationsTable,
        userName: usersTable.name,
        userEmail: usersTable.email,
        userPhone: usersTable.phone,
      })
      .from(kycVerificationsTable)
      .leftJoin(usersTable, eq(kycVerificationsTable.userId, usersTable.id))
      .orderBy(desc(kycVerificationsTable.submittedAt));

    res.json({ data: list });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch pending KYC list" });
  }
});

/**
 * POST /kyc/:id/review - Admin route: Approve or reject KYC submission
 */
router.post("/kyc/:id/review", async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body; // 'approved' or 'rejected'
    const adminUser = (req as any).user;

    if (!["approved", "rejected"].includes(status)) {
      res.status(400).json({ error: "Invalid status. Must be 'approved' or 'rejected'." });
      return;
    }

    const kycId = parseInt(String(id), 10);
    const [kyc] = await db.select().from(kycVerificationsTable).where(eq(kycVerificationsTable.id, kycId));
    if (!kyc) {
      res.status(404).json({ error: "KYC verification record not found" });
      return;
    }

    const [updatedKyc] = await db
      .update(kycVerificationsTable)
      .set({
        status: status as any,
        rejectionReason: status === "rejected" ? rejectionReason || "Documents incomplete or invalid" : null,
        verifiedAt: new Date(),
        verifiedBy: adminUser ? adminUser.id : null,
        updatedAt: new Date(),
      })
      .where(eq(kycVerificationsTable.id, kycId))
      .returning();

    // If customer and approved, sync Aadhaar/PAN back to customer table if applicable
    if (kyc.userRole === "customer" && kyc.referenceId && status === "approved") {
      await db
        .update(customersTable)
        .set({
          aadhaar: kyc.aadhaarNumber || undefined,
          pan: kyc.panNumber || undefined,
        })
        .where(eq(customersTable.id, kyc.referenceId));
    }

    res.json({ message: `KYC application ${status}`, kyc: updatedKyc });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to review KYC application" });
  }
});

export default router;
