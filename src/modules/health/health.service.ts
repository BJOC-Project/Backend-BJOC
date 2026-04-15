import { pool } from "../../database/db";
import { ServiceUnavailableError } from "../../errors/app-error";

const DB_PING_TIMEOUT_MS = 2500;

export async function healthGetStatus() {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("Database ping timed out")),
      DB_PING_TIMEOUT_MS,
    ),
  );

  try {
    await Promise.race([pool.query("SELECT 1"), timeout]);
  } catch {
    throw new ServiceUnavailableError("Database is unreachable");
  }

  return {
    status: "ok",
    database: "connected",
    timestamp: new Date().toISOString(),
  };
}
