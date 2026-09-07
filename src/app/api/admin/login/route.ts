import { cookies } from "next/headers";
import { z } from "zod";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_DURATION_SECONDS,
  createAdminSessionToken,
  validateAdminCredentials,
} from "@/lib/security/admin-session";

const credentialsSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1).max(100),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Usuario o contraseña incorrectos." },
      { status: 401 },
    );
  }

  const credentials = credentialsSchema.safeParse(body);
  if (
    !credentials.success ||
    !validateAdminCredentials(
      credentials.data.username,
      credentials.data.password,
    )
  ) {
    return Response.json(
      { error: "Usuario o contraseña incorrectos." },
      { status: 401 },
    );
  }

  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: ADMIN_SESSION_DURATION_SECONDS,
  });

  return Response.json({ authenticated: true });
}
