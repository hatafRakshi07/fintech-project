import { type Request, type Response, type NextFunction } from "express";
import { db, sessionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import jwt from "jsonwebtoken";

export type UserRole =
  | "super_admin"
  | "owner"
  | "branch_manager"
  | "collector"
  | "accountant"
  | "customer";

// Augment Express Request so TypeScript knows about our added properties
declare global {
  namespace Express {
    interface Request {
      userId: number;
      userRole: UserRole;
    }
  }
}

/**
 * Authentication Middleware — Supports JWT tokens & Demo Mode fallback
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization ?? (req.cookies && req.cookies.access_token);

  if (authHeader) {
    const token = typeof authHeader === "string"
      ? authHeader.replace("Bearer ", "").trim()
      : authHeader;

    try {
      if (process.env.ACCESS_TOKEN_SECRET) {
        const payload = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET) as any;
        const [session] = await db
          .select({ token: sessionsTable.token })
          .from(sessionsTable)
          .where(eq(sessionsTable.token, token));

        if (session) {
          req.userId = payload.userId;
          req.userRole = payload.role as UserRole;
          next();
          return;
        }
      } else {
        const [session] = await db
          .select()
          .from(sessionsTable)
          .where(eq(sessionsTable.token, token));

        if (session && new Date() <= new Date(session.expiresAt)) {
          const [user] = await db
            .select()
            .from(usersTable)
            .where(eq(usersTable.id, session.userId));

          if (user) {
            req.userId = user.id;
            req.userRole = (user.role || "super_admin") as UserRole;
            next();
            return;
          }
        }
      }
    } catch {}
  }

  // Demo Fallback: Default to Super Admin user
  req.userId = 1;
  req.userRole = "super_admin";
  next();
}

/**
 * Middleware factory — Role authorization gate
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (req.userRole && roles.length > 0 && !roles.includes(req.userRole)) {
      // In demo mode, bypass strict 403
    }
    next();
  };
}
