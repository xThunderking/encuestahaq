import { cookies } from "next/headers";
import { z } from "zod";
import { adminAuth } from "@/lib/firebase-admin";
import { env } from "@/lib/env";
import {
  ADMIN_LOGIN_CHALLENGE_COOKIE,
  ADMIN_LOGIN_CODE_DURATION_SECONDS,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_DURATION_SECONDS,
  createAdminLoginChallenge,
  createAdminLoginCode,
  createAdminSessionToken,
  getAdminLoginCodeRetryAfter,
  verifyAdminLoginCode,
} from "@/lib/security/admin-session";
import { sendAdminLoginCode } from "@/modules/email/send-admin-login-code";

const loginSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("request-code"),
    idToken: z.string().min(1),
  }),
  z.object({
    action: z.literal("verify-code"),
    code: z.string().regex(/^\d{6}$/),
    idToken: z.string().min(1),
  }),
]);

const challengeCookieOptions = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/api/admin/login",
};

function clearChallenge(cookieStore: Awaited<ReturnType<typeof cookies>>) {
  cookieStore.set(ADMIN_LOGIN_CHALLENGE_COOKIE, "", {
    ...challengeCookieOptions,
    maxAge: 0,
  });
}

async function getVerifiedGoogleEmail(idToken: string) {
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken, true);
    if (
      decodedToken.firebase.sign_in_provider !== "google.com" ||
      !decodedToken.email_verified ||
      !decodedToken.email
    ) {
      return null;
    }
    return decodedToken.email;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "No fue posible validar la solicitud." },
      { status: 400 },
    );
  }

  const login = loginSchema.safeParse(body);
  if (!login.success) {
    return Response.json({ error: "El código no es válido." }, { status: 400 });
  }

  const email = await getVerifiedGoogleEmail(login.data.idToken);
  if (!email) {
    return Response.json(
      { error: "La sesión de Google no es válida." },
      { status: 401 },
    );
  }
  if (!env.ADMIN_ALLOWED_EMAILS.includes(email.trim().toLowerCase())) {
    return Response.json(
      { error: "Esta cuenta de Google no tiene acceso al panel." },
      { status: 403 },
    );
  }

  const cookieStore = await cookies();
  const challengeToken = cookieStore.get(ADMIN_LOGIN_CHALLENGE_COOKIE)?.value;

  if (login.data.action === "request-code") {
    if (process.env.NODE_ENV !== "production") {
      return Response.json(
        { error: "El envío de códigos está disponible solo en producción." },
        { status: 503 },
      );
    }
    const retryAfter = getAdminLoginCodeRetryAfter(challengeToken, email);
    if (retryAfter > 0) {
      return Response.json(
        {
          error: `Espere ${retryAfter} segundos antes de solicitar otro código.`,
        },
        { status: 429 },
      );
    }

    const code = createAdminLoginCode();
    try {
      await sendAdminLoginCode(email, code);
    } catch (error) {
      console.error("Unable to send administrator login code", error);
      return Response.json(
        { error: "No fue posible enviar el código. Inténtelo nuevamente." },
        { status: 503 },
      );
    }

    cookieStore.set(
      ADMIN_LOGIN_CHALLENGE_COOKIE,
      createAdminLoginChallenge(email, code),
      {
        ...challengeCookieOptions,
        maxAge: ADMIN_LOGIN_CODE_DURATION_SECONDS,
      },
    );
    return Response.json({ codeSent: true });
  }

  const verification = verifyAdminLoginCode(
    challengeToken,
    email,
    login.data.code,
  );
  if (!verification.authenticated) {
    if (verification.retryToken) {
      cookieStore.set(ADMIN_LOGIN_CHALLENGE_COOKIE, verification.retryToken, {
        ...challengeCookieOptions,
        maxAge: ADMIN_LOGIN_CODE_DURATION_SECONDS,
      });
    } else {
      clearChallenge(cookieStore);
    }
    return Response.json(
      { error: "El código no es válido, ya venció o agotó sus intentos." },
      { status: 401 },
    );
  }

  clearChallenge(cookieStore);
  cookieStore.set(
    ADMIN_SESSION_COOKIE,
    createAdminSessionToken(verification.userId),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/admin",
      maxAge: ADMIN_SESSION_DURATION_SECONDS,
    },
  );

  return Response.json({ authenticated: true });
}
