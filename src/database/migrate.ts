import { migrate } from "drizzle-orm/node-postgres/migrator";
import { assertDatabaseUrlReady } from "../config/env";
import { logger } from "../config/logger";
import { db, pool } from "./db";

async function runMigrations() {
  assertDatabaseUrlReady();

  try {
    await migrate(db, { migrationsFolder: "./src/database/migration" });
    logger.info("Database migrations finished");
  } finally {
    await pool.end();
  }
}

runMigrations().catch((error) => {
  logger.error(
    {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    },
    "Database migration failed",
  );
  process.exitCode = 1;
});
