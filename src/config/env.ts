import dotenv from "dotenv";
import { z } from "zod";

dotenv.config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().min(1).default("7d"),
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
  APP_NAME: z.string().min(1).default("BJOC Backend"),
  EMAIL_USER: z.string().email("EMAIL_USER must be a valid email"),
  EMAIL_PASS: z.string().min(1, "EMAIL_PASS is required"),
  EMAIL_SERVICE: z.string().trim().min(1).optional(),
  EMAIL_FROM: z.string().email().optional(),
  SMTP_HOST: z.string().trim().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  SMTP_SECURE: z.union([
    z.boolean(),
    z.string().trim().toLowerCase().transform((value) => value === "true"),
  ]).optional(),
  SUPABASE_URL: z.url("SUPABASE_URL must be a valid URL"),
  SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  throw new Error(`Invalid environment variables: ${parsedEnv.error.message}`);
}

const env = parsedEnv.data;

export const appEnv = {
  ...env,
  corsOrigins: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean),
};

export function assertDatabaseUrlReady() {
  if (appEnv.DATABASE_URL.includes("<YOUR_SUPABASE_DB_PASSWORD>")) {
    throw new Error(
      "DATABASE_URL still uses the placeholder password. Replace <YOUR_SUPABASE_DB_PASSWORD> with your real Supabase database password.",
    );
  }
}
