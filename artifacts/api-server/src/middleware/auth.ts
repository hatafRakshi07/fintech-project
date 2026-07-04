import { type Request, type Response, type NextFunction } from "express";
import { db, sessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = req.headers.authorization;
  const token = auth?.replace("Bearer ", "").trim();
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.token, token));

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      await db.delete(sessionsTable).where(eq(sessionsTable.token, token)).catch(() => {});
    }
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  (req as Request & { userId: number }).userId = session.userId;
  next();
}
