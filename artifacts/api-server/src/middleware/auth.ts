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
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: "Missing authorization header" });
    return;
  }
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    res.status(401).json({ error: "Invalid token format" });
    return;
  }

  // Look up session
  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.token, token));

  if (!session || new Date() > new Date(session.expiresAt)) {
    res.status(401).json({ error: "Session expired or invalid" });
    return;
  }

  // Get user details
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, session.userId));

  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  req.userId = user.id;
  req.userRole = user.role as UserRole;
  next();
}

/**
 * Middleware factory — 403 if the authenticated user's role is not in the allowed list.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({ error: "Forbidden: insufficient permissions" });
      return;
    }
    next();
  };
}
