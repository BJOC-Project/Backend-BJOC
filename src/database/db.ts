import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { appEnv } from "../config/env";
import { schema } from "./schema";

export const pool = new Pool({
  connectionString: appEnv.DATABASE_URL,
  ssl: appEnv.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

export const db = drizzle(pool, {
  schema,
  logger: appEnv.NODE_ENV === "development",
});
