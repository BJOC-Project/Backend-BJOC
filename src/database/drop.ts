import { assertDatabaseUrlReady } from "../config/env";
import { logger } from "../config/logger";
import { pool } from "./db";

const dropSql = `
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;
DROP SCHEMA IF EXISTS drizzle CASCADE;
`;

async function dropDatabaseObjects() {
  assertDatabaseUrlReady();

  try {
    await pool.query(dropSql);
    logger.info("Dropped public and drizzle schemas");
  } finally {
    await pool.end();
  }
}

dropDatabaseObjects().catch((error) => {
  logger.error(
    {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
    },
    "Database drop failed",
  );
  process.exitCode = 1;
});
