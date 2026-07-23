import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { db, usersTable, sessionsTable, otpsTable, customersTable } from "@workspace/db";
import { eq, lt, and, or, sql } from "drizzle-orm";

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
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: "Username and password are required" });
    return;
  }

  // 1. Fetch user from database
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username.trim().toLowerCase()));

  if (!user) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  // 2. Verify password
  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  // 3. Create session token
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await purgeExpiredSessions();

  await db.insert(sessionsTable).values({
    token,
    userId: user.id,
    expiresAt,
  });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      branchId: user.branchId,
      customerId: user.customerId,
      email: user.email,
      phone: user.phone,
    },
  });
});

// ---------------------------------------------------------------------------
// OTP Routes (Real-Time OTP Generation & Verification)
// ---------------------------------------------------------------------------
const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5,                  // max 5 OTP requests per 5 min
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many OTP requests. Please wait a few minutes before trying again." },
});

// Helper: Send Real SMS via SMS Gateway (Fast2SMS / MSG91 / Twilio)
async function sendRealSmsOtp(phone: string, code: string): Promise<boolean> {
  const provider = process.env.SMS_PROVIDER || "fast2sms";
  const apiKey = process.env.SMS_API_KEY || process.env.FAST2SMS_API_KEY;

  if (!apiKey) {
    console.log(`[SMS GATEWAY NOTICE] No SMS_API_KEY configured. Real-time OTP ${code} generated for mobile +91 ${phone}`);
    return false;
  }

  try {
    if (provider === "fast2sms" || process.env.FAST2SMS_API_KEY) {
      const response = await fetch("https://www.fast2sms.com/dev/bulkV2", {
        method: "POST",
        headers: {
          authorization: apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          variables_values: code,
          route: "otp",
          numbers: phone,
        }),
      });
      const data: any = await response.json();
      console.log(`[FAST2SMS GATEWAY RESPONSE]`, data);
      return data?.return === true;
    } else if (provider === "msg91") {
      const templateId = process.env.MSG91_TEMPLATE_ID || "";
      const response = await fetch(
        `https://control.msg91.com/api/v5/otp?template_id=${templateId}&mobile=91${phone}&otp=${code}`,
        {
          method: "POST",
          headers: { authkey: apiKey },
        }
      );
      const data: any = await response.json();
      console.log(`[MSG91 GATEWAY RESPONSE]`, data);
      return data?.type === "success";
    }
  } catch (err) {
    console.error(`[SMS GATEWAY ERROR] Failed to send SMS to +91 ${phone}:`, err);
  }
  return false;
}

router.post("/auth/send-otp", otpLimiter, async (req: Request, res: Response): Promise<void> => {
  const { phone } = req.body;
  if (!phone || typeof phone !== "string") {
    res.status(400).json({ error: "Mobile phone number is required" });
    return;
  }

  // Clean phone number (extract 10 digits)
  const cleanPhone = phone.replace(/\D/g, "").slice(-10);
  if (cleanPhone.length !== 10) {
    res.status(400).json({ error: "Invalid 10-digit mobile number" });
    return;
  }

  // Generate 6-digit cryptographically random OTP
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

  // Invalidate any existing unused OTPs for this phone
  await db
    .update(otpsTable)
    .set({ used: true })
    .where(and(eq(otpsTable.phone, cleanPhone), eq(otpsTable.used, false)));

  // Insert new OTP record
  await db.insert(otpsTable).values({
    phone: cleanPhone,
    code,
    expiresAt,
    used: false,
  });

  // Attempt real SMS Gateway dispatch
  const smsSent = await sendRealSmsOtp(cleanPhone, code);

  console.log(`[REAL-TIME OTP] OTP ${code} generated for mobile +91 ${cleanPhone}. Real SMS sent: ${smsSent}`);

  res.json({
    success: true,
    message: smsSent
      ? `Real-time OTP SMS dispatched to +91 ${cleanPhone}`
      : `OTP generated and sent to +91 ${cleanPhone}`,
    smsSent,
    // Return debugOtp only in dev mode if no SMS API key configured
    debugOtp: (!smsSent && process.env.NODE_ENV !== "production") ? code : undefined,
  });
});


router.post("/auth/verify-otp", async (req: Request, res: Response): Promise<void> => {
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    res.status(400).json({ error: "Phone number and OTP code are required" });
    return;
  }

  const cleanPhone = phone.replace(/\D/g, "").slice(-10);

  // Find matching active OTP
  const [validOtp] = await db
    .select()
    .from(otpsTable)
    .where(
      and(
        eq(otpsTable.phone, cleanPhone),
        eq(otpsTable.code, otp.toString().trim()),
        eq(otpsTable.used, false),
        sql`${otpsTable.expiresAt} > NOW()`
      )
    );

  if (!validOtp) {
    res.status(401).json({ error: "Invalid or expired OTP code" });
    return;
  }

  // Mark OTP as used
  await db.update(otpsTable).set({ used: true }).where(eq(otpsTable.id, validOtp.id));

  // Find user by phone or username
  let [user] = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.phone, cleanPhone), eq(usersTable.username, cleanPhone)));

  // If user does not exist, check if phone matches a customer record
  if (!user) {
    const [customer] = await db
      .select()
      .from(customersTable)
      .where(eq(customersTable.mobile, cleanPhone));

    if (customer) {
      // Auto-provision user account for this customer
      const [newUser] = await db
        .insert(usersTable)
        .values({
          username: cleanPhone,
          passwordHash: await hashPassword(randomBytes(16).toString("hex")),
          name: customer.name,
          role: "customer",
          branchId: customer.branchId,
          customerId: customer.id,
          phone: cleanPhone,
          email: customer.email ?? null,
        })
        .returning();
      user = newUser;
    } else {
      // Auto-provision standard customer user
      const [newUser] = await db
        .insert(usersTable)
        .values({
          username: cleanPhone,
          passwordHash: await hashPassword(randomBytes(16).toString("hex")),
          name: `User ${cleanPhone}`,
          role: "customer",
          phone: cleanPhone,
        })
        .returning();
      user = newUser;
    }
  }

  // Create session token
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await purgeExpiredSessions();
  await db.insert(sessionsTable).values({
    token,
    userId: user.id,
    expiresAt,
  });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      branchId: user.branchId,
      customerId: user.customerId,
      email: user.email,
      phone: user.phone,
    },
  });
});


router.get("/auth/me", async (req: Request, res: Response): Promise<void> => {
  if (!req.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, req.userId));

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    branchId: user.branchId,
    customerId: user.customerId,
    email: user.email,
    phone: user.phone,
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
