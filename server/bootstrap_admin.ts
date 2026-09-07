import "dotenv/config";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { hashPassword } from "./_core/auth";
import { eq } from "drizzle-orm";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.");
    process.exit(1);
  }

  const db = await getDb();
  if (!db) {
    console.error("Database connection failed.");
    process.exit(1);
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
  if (existing[0]) {
    if (existing[0].role === "admin") {
      console.log(`User ${normalizedEmail} is already an admin.`);
    } else {
      await db.update(users).set({ role: "admin" }).where(eq(users.id, existing[0].id));
      console.log(`Promoted existing user ${normalizedEmail} to admin.`);
    }
  } else {
    const passwordHash = await hashPassword(password);
    await db.insert(users).values({
      email: normalizedEmail,
      passwordHash,
      name: "Platform Admin",
      role: "admin",
    });
    console.log(`Created new admin user: ${normalizedEmail}`);
  }

  process.exit(0);
}

main().catch(err => {
  console.error("Bootstrap failed:", err);
  process.exit(1);
});
