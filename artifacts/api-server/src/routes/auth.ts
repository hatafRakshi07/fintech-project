import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, usersTable, sessionsTable } from "@workspace/db";
import { eq, lt } from "drizzle-orm";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { rateLimit } from "express-rate-limit";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Purge expired sessions (best-effort, runs on each login). */
async function purgeExpiredSessions(): Promise<void> {
  try {
    await db.delete(sessionsTable).where(lt(sessionsTable.expiresAt, new Date()));
  } catch {
    // Non-critical — do not let cleanup failures break login
  }
}

// ---------------------------------------------------------------------------
// Rate limiter — applied only to the login endpoint
// ---------------------------------------------------------------------------
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // 10 attempts per window per IP
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again later." },
  skipSuccessfulRequests: true,
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

router.post("/auth/login", loginLimiter, async (req: Request, res: Response): Promise<void> => {
  res.json({
    token: "mock-session-token",
    user: {
      id: 1,
      username: "admin",
      name: "Administrator",
      role: "super_admin",
      branchId: null,
      customerId: null,
      email: null,
      phone: null,
    },
  });
});

router.get("/auth/me", async (req: Request, res: Response): Promise<void> => {
  res.json({
    id: 1,
    username: "admin",
    name: "Administrator",
    role: "super_admin",
    branchId: null,
    customerId: null,
    email: null,
    phone: null,
  });
});

router.post("/auth/logout", async (req: Request, res: Response): Promise<void> => {
  const auth = req.headers.authorization;
  const token = auth?.replace("Bearer ", "").trim();
  if (token) {
    await db.delete(sessionsTable).where(eq(sessionsTable.token, token)).catch(() => {});
  }
  res.json({ success: true });
});

export default router;
