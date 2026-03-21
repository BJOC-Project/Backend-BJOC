import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { logger } from "../config/logger";
import { assertDatabaseUrlReady } from "../config/env";
import { pool } from "./db";

async function runSqlSeed(filename: string) {
  const sql = (await readFile(resolve(process.cwd(), `src/database/seed/${filename}`), "utf8")).replace(/^\uFEFF/, "");
  await pool.query(sql);
}

async function runSeed() {
  assertDatabaseUrlReady();

  try {
    await runSqlSeed("role.sql");
    await runSqlSeed("user.sql");
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
