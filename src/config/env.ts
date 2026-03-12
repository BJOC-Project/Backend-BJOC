import dotenv from "dotenv";

dotenv.config();

/**
 * Required environment variables
 */
const requiredEnv = [
  "PORT",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

/**
 * Validate required environment variables
 */
requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    throw new Error(`❌ Missing required environment variable: ${key}`);
  }
});

/**
 * Export validated environment variables
 */
export const env = {
  PORT: Number(process.env.PORT) || 5000,
  SUPABASE_URL: process.env.SUPABASE_URL as string,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
};