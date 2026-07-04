/**
 * Seed script — creates (or resets) the default admin user with a bcrypt-hashed password.
 *
 * Usage:
 *   DATABASE_URL=postgres://... pnpm --filter @workspace/scripts run seed
 *
 * Environment variables:
 *   ADMIN_USERNAME  (default: "admin")
 *   ADMIN_PASSWORD  (default: "changeme123")  ← change before going to production!
 *   ADMIN_NAME      (default: "Administrator")
 */

import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const username = process.env.ADMIN_USERNAME ?? "admin";
const password = process.env.ADMIN_PASSWORD ?? "changeme123";
const name = process.env.ADMIN_NAME ?? "Administrator";

if (password === "changeme123") {
  console.warn(
    "\n⚠️  WARNING: Using default password 'changeme123'. " +
    "Set ADMIN_PASSWORD env var before running in production!\n"
  );
}

console.log(`Seeding admin user: ${username}`);

const passwordHash = await bcrypt.hash(password, 12);

const existing = await db.select().from(usersTable).where(eq(usersTable.username, username));

if (existing.length > 0) {
  await db
    .update(usersTable)
    .set({ passwordHash, name, role: "super_admin" })
    .where(eq(usersTable.username, username));
  console.log(`✓ Updated existing user '${username}'.`);
} else {
  await db.insert(usersTable).values({ username, passwordHash, name, role: "super_admin" });
  console.log(`✓ Created new user '${username}'.`);
}

console.log("Seed complete.");
process.exit(0);
