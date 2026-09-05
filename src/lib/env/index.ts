import { z } from "zod";

const emptyStringToUndefined = (value: unknown) =>
  value === "" ? undefined : value;

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(1),
  APP_URL: z.string().url(),
  PUBLIC_SURVEY_URL: z.string().url(),
  ADMIN_URL: z.string().url(),
  SMTP_HOST: z.preprocess(emptyStringToUndefined, z.string().optional()),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .preprocess(
      emptyStringToUndefined,
      z.enum(["true", "false"]).default("false"),
    )
    .transform((value) => value === "true"),
  SMTP_USER: z.preprocess(emptyStringToUndefined, z.string().optional()),
  SMTP_PASSWORD: z.preprocess(emptyStringToUndefined, z.string().optional()),
  SMTP_FROM: z.preprocess(emptyStringToUndefined, z.string().optional()),
  TOKEN_SECRET: z.string().min(1),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
