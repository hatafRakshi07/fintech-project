import { Router, type IRouter, type Request, type Response } from "express";
import { db, agentsTable, usersTable, customersTable, collectionsTable, kycVerificationsTable, branchesTable } from "@workspace/db";
import { eq, and, sql, desc, count } from "drizzle-orm";
import bcrypt from "bcryptjs";

const router: IRouter = Router();

async function getNextCustomerRef(): Promise<string> {
  const [row] = await db.select({ max: sql<number>`coalesce(max(id),0)` }).from(customersTable);
  const n = (row?.max ?? 0) + 1;
  return `REF${String(n).padStart(6, "0")}`;
}

async function getNextAgentCode(): Promise<string> {
  const [row] = await db.select({ max: sql<number>`coalesce(max(id),0)` }).from(agentsTable);
  const n = (row?.max ?? 0) + 1;
  return `AGT${String(n).padStart(4, "0")}`;
}

/**
 * GET /agents/me - Get current logged-in agent profile & performance statistics
 */
router.get("/agents/me", async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    let agent = null;
    if (user.agentId) {
      [agent] = await db.select().from(agentsTable).where(eq(agentsTable.id, user.agentId));
    } else {
      [agent] = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id));
    }

    if (!agent) {
      res.status(404).json({ error: "Agent profile not found for this user account" });
      return;
    }

    // Calculate agent stats
    const [customerCountRow] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(customersTable)
      .where(eq(customersTable.agentId, agent.id));

    const totalReferredCustomers = customerCountRow?.total || 0;

    // Total collections from agent's referred customers
    const [collectionRow] = await db
      .select({ total: sql<string>`coalesce(sum(${collectionsTable.amount}), 0)` })
      .from(collectionsTable)
      .innerJoin(customersTable, eq(collectionsTable.customerId, customersTable.id))
      .where(eq(customersTable.agentId, agent.id));

    const totalCollectionAmount = parseFloat(collectionRow?.total || "0");
    const commissionRate = parseFloat(agent.commissionRate || "2.5");
    const estimatedCommission = (totalCollectionAmount * commissionRate) / 100;

    // Fetch Agent KYC status
    const [kyc] = await db
      .select()
      .from(kycVerificationsTable)
      .where(eq(kycVerificationsTable.userId, user.id))
      .orderBy(desc(kycVerificationsTable.createdAt))
      .limit(1);

    res.json({
      agent,
      stats: {
        totalReferredCustomers,
        totalCollectionAmount,
        commissionRate,
        estimatedCommission,
      },
      kycStatus: kyc ? kyc.status : "not_submitted",
      kycRecord: kyc || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch agent profile" });
  }
});

/**
 * GET /agents - Admin route: List all agents
 */
router.get("/agents", async (req: Request, res: Response): Promise<void> => {
  try {
    const agents = await db
      .select({
        agent: agentsTable,
        branchName: branchesTable.name,
      })
      .from(agentsTable)
      .leftJoin(branchesTable, eq(agentsTable.branchId, branchesTable.id))
      .orderBy(desc(agentsTable.createdAt));

    const data = await Promise.all(
      agents.map(async (row) => {
        const [cCount] = await db
          .select({ total: sql<number>`count(*)::int` })
          .from(customersTable)
          .where(eq(customersTable.agentId, row.agent.id));
        return {
          ...row.agent,
          branchName: row.branchName,
          referredCustomers: cCount?.total || 0,
        };
      })
    );

    res.json({ data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to list agents" });
  }
});

/**
 * POST /agents - Create a new agent (Admin / Manager)
 */
router.post("/agents", async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, mobile, email, branchId, commissionRate, username, password } = req.body;

    if (!name || !mobile || !branchId || !username || !password) {
      res.status(400).json({ error: "Name, mobile, branchId, username, and password are required" });
      return;
    }

    const agentCode = await getNextAgentCode();
    const passwordHash = await bcrypt.hash(password, 12);

    // Create Agent record
    const [agent] = await db
      .insert(agentsTable)
      .values({
        agentCode,
        name,
        mobile,
        email,
        branchId: parseInt(branchId, 10),
        commissionRate: commissionRate ? String(commissionRate) : "2.5",
        status: "active",
      })
      .returning();

    // Create User record linked to Agent
    const [user] = await db
      .insert(usersTable)
      .values({
        username,
        passwordHash,
        name,
        role: "agent",
        branchId: parseInt(branchId, 10),
        agentId: agent.id,
        email,
        phone: mobile,
      })
      .returning();

    // Link userId on agent record
    await db.update(agentsTable).set({ userId: user.id }).where(eq(agentsTable.id, agent.id));

    res.json({ message: "Agent created successfully", agent, user });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to create agent" });
  }
});

/**
 * POST /agents/onboard-customer - Agent endpoint to register a new customer
 */
router.post("/agents/onboard-customer", async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    let agentId = user.agentId;
    if (!agentId) {
      const [agt] = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id));
      agentId = agt?.id;
    }

    const { name, mobile, alternateMobile, email, aadhaar, pan, address, city, nomineeName, nomineeRelation, branchId } = req.body;

    if (!name || !mobile) {
      res.status(400).json({ error: "Customer name and mobile number are required" });
      return;
    }

    const targetBranchId = branchId ? parseInt(branchId, 10) : user.branchId || 1;
    const refNum = await getNextCustomerRef();

    const [customer] = await db
      .insert(customersTable)
      .values({
        referenceNumber: refNum,
        name,
        mobile,
        alternateMobile,
        email,
        aadhaar,
        pan,
        address,
        city,
        nomineeName,
        nomineeRelation,
        branchId: targetBranchId,
        agentId: agentId || null,
        status: "active",
      })
      .returning();

    res.json({ message: "Customer onboarded successfully", customer });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to onboard customer" });
  }
});

/**
 * GET /agents/my-customers - Get list of customers referred by the logged-in agent
 */
router.get("/agents/my-customers", async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as any).user;
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    let agentId = user.agentId;
    if (!agentId) {
      const [agt] = await db.select().from(agentsTable).where(eq(agentsTable.userId, user.id));
      agentId = agt?.id;
    }

    if (!agentId) {
      res.status(404).json({ error: "No agent account linked to this user" });
      return;
    }

    const customers = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.agentId, agentId))
      .orderBy(desc(customersTable.createdAt));

    res.json({ data: customers });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Failed to fetch referred customers" });
  }
});

export default router;
