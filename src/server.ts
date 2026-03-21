import app from "./app";
import { appEnv, assertDatabaseUrlReady } from "./config/env";
import { logger } from "./config/logger";
import { pool } from "./database/db";

assertDatabaseUrlReady();

const server = app.listen(appEnv.PORT, () => {
  logger.info(`Server running on port ${appEnv.PORT}`);
});

async function shutdown(signal: string) {
  logger.info(`${signal} received. Shutting down.`);

  server.close(async () => {
    await pool.end();
    logger.info("HTTP server closed");
    process.exit(0);
  });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}
