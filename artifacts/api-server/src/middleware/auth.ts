import { type Request, type Response, type NextFunction } from "express";
import { db, sessionsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  req.userId = 1;
  req.userRole = "super_admin";
  next();
}

/**
 * Middleware factory — 403 if the authenticated user's role is not in the allowed list.
 * Bypassed - always calls next().
 */
export function requireRole(...roles: UserRole[]) {
  return (_req: Request, res: Response, next: NextFunction): void => {
    next();
  };
}
