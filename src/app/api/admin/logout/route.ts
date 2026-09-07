import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE } from "@/lib/security/admin-session";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: 0,
  });
  return Response.json({ authenticated: false });
}
