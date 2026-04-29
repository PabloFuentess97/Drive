import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
  JWT_EXPIRES_IN: z.string().default("7d"),
  STORAGE_DIR: z.string().default("./storage"),
  DEFAULT_QUOTA_BYTES: z.coerce.number().default(10 * 1024 * 1024 * 1024),
  MAX_UPLOAD_BYTES: z.coerce.number().default(2 * 1024 * 1024 * 1024),
  ADMIN_EMAILS: z.string().default(""),
  NEXT_PUBLIC_APP_NAME: z.string().default("PersonalDrive"),
  NEXT_PUBLIC_APP_URL: z.string().default("http://localhost:3000"),
});

export const env = schema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  STORAGE_DIR: process.env.STORAGE_DIR,
  DEFAULT_QUOTA_BYTES: process.env.DEFAULT_QUOTA_BYTES,
  MAX_UPLOAD_BYTES: process.env.MAX_UPLOAD_BYTES,
  ADMIN_EMAILS: process.env.ADMIN_EMAILS,
  NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
});

export const adminEmails = env.ADMIN_EMAILS
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
