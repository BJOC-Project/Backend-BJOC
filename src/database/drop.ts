import { assertDatabaseUrlReady } from "../config/env";
import { logger } from "../config/logger";
import { pool } from "./db";

const dropSql = `
DO $$
DECLARE
  current_table RECORD;
  current_type RECORD;
BEGIN
  FOR current_table IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE', current_table.tablename);
  END LOOP;

  FOR current_type IN
    SELECT typname
    FROM pg_type
    WHERE typnamespace = 'public'::regnamespace
      AND typtype = 'e'
  LOOP
    EXECUTE format('DROP TYPE IF EXISTS public.%I CASCADE', current_type.typname);
  END LOOP;
END $$;
`;

async function dropDatabaseObjects() {
  assertDatabaseUrlReady();

  try {
    await pool.query(dropSql);
    logger.info("Dropped public tables and enums");
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
