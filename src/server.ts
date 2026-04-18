import { migrate } from "drizzle-orm/node-postgres/migrator";
import path from "node:path";
import app from "./app";
import { appEnv, assertDatabaseUrlReady } from "./config/env";
import { logger } from "./config/logger";
import { db, pool } from "./database/db";

assertDatabaseUrlReady();

async function start() {
  try {
    await migrate(db, { migrationsFolder: path.join(__dirname, "../src/database/migration") });
    logger.info("Database migrations applied");
  } catch (err) {
    logger.error({ err }, "Database migration failed — server will still start");
  }

  const server = app.listen(appEnv.PORT, () => {
    logger.info(`Server running on port ${appEnv.PORT}`);
  });

  function shutdown(signal: string) {
    logger.info(`${signal} received. Shutting down.`);
    server.close(async () => {
      await pool.end();
      logger.info("HTTP server closed");
      process.exit(0);
    });
  }

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => shutdown(signal));
  }
}

void start();
