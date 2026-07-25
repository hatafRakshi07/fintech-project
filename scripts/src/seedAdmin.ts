import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

async function main() {
  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const existingUser = await db.select().from(usersTable).where(eq(usersTable.username, adminUsername)).limit(1);
  
  if (existingUser.length > 0) {
    console.log(`Admin user '${adminUsername}' already exists.`);
    process.exit(0);
  }

  // Generate a random 12-character secure password
  const rawPassword = randomBytes(9).toString("base64").slice(0, 12);
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(rawPassword, salt);

  const adminName = process.env.ADMIN_NAME || "Super Admin";

  await db.insert(usersTable).values({
    username: adminUsername,
    passwordHash,
    name: adminName,
    role: "super_admin",
  });

  console.log("=========================================");
  console.log("ADMIN USER CREATED SUCCESSFULLY");
  console.log("=========================================");
  console.log(`Username: ${adminUsername}`);
  console.log(`Password: ${rawPassword}`);
  console.log("=========================================");
  console.log("IMPORTANT: Save this password now! It will not be shown again.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Error seeding admin:", err);
  process.exit(1);
});
