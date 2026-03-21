import { readFile } from "node:fs/promises";
import { eq } from "drizzle-orm";
import { logger } from "../config/logger";
import { appEnv, assertDatabaseUrlReady } from "../config/env";
import { comparePassword, hashPassword } from "../library/bcrypt";
import { db, pool } from "./db";
import { roles, users } from "./schema";

async function seedRoles() {
  const sql = await readFile("src/database/seed/role.sql", "utf8");
  await pool.query(sql);
}

async function seedDefaultAdmin() {
  if (!appEnv.DEFAULT_ADMIN_EMAIL || !appEnv.DEFAULT_ADMIN_PASSWORD) {
    return;
  }

  const [adminRole] = await db.select({ id: roles.id }).from(roles).where(eq(roles.name, "admin")).limit(1);

  if (!adminRole) {
    throw new Error("Admin role is missing. Run the role seed first.");
  }

  const [existingAdmin] = await db.select({ id: users.id, passwordHash: users.passwordHash }).from(users).where(eq(users.email, appEnv.DEFAULT_ADMIN_EMAIL)).limit(1);
  const passwordHash = await hashPassword(appEnv.DEFAULT_ADMIN_PASSWORD);

  if (!existingAdmin) {
    await db.insert(users).values({
      roleId: adminRole.id,
      email: appEnv.DEFAULT_ADMIN_EMAIL,
      passwordHash,
      firstName: "System",
      lastName: "Admin",
      status: "active",
    });
    logger.info("Seeded default admin account");
    return;
  }

  const passwordMatches = await comparePassword(appEnv.DEFAULT_ADMIN_PASSWORD, existingAdmin.passwordHash);
  if (!passwordMatches) {
    await db.update(users).set({ passwordHash }).where(eq(users.id, existingAdmin.id));
    logger.info("Updated default admin password from seed");
  }
}

async function runSeed() {
  assertDatabaseUrlReady();

  try {
    await seedRoles();
    await seedDefaultAdmin();
    logger.info("Database seed finished");
  } finally {
    await pool.end();
  }
}

runSeed().catch((error) => {
  logger.error(
    {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    },
    "Database seed failed",
  );
  process.exitCode = 1;
});
