import nodemailer from "nodemailer";
import { env } from "@/lib/env";

function getMailTransport() {
  if (
    !env.SMTP_HOST ||
    !env.SMTP_USER ||
    !env.SMTP_PASSWORD ||
    !env.SMTP_FROM
  ) {
    throw new Error("SMTP is not configured");
  }

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    },
    tls: {
      rejectUnauthorized: env.SMTP_TLS_REJECT_UNAUTHORIZED,
    },
  });
}

export async function sendAdminLoginCode(to: string, code: string) {
  await getMailTransport().sendMail({
    from: env.SMTP_FROM,
    to,
    subject: "Código de acceso al panel de encuestas",
    text: `Su código de acceso es ${code}. Vence en 10 minutos y solo puede usarse una vez.`,
  });
}
