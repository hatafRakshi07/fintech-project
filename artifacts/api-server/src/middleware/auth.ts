import { type Request, type Response, type NextFunction } from "express";

export type UserRole =
  | "super_admin"
  | "owner"
  | "branch_manager"
  | "collector"
  | "accountant"
  | "customer";

declare global {
  namespace Express {
    interface Request {
      userId: string;
      userRole: UserRole;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Demo Fallback: Default to Super Admin user
  req.userId = "demo-user-id";
  req.userRole = "super_admin";
  next();
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    next();
  };
}
