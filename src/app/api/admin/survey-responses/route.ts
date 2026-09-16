import { cookies } from "next/headers";
import { adminDb } from "@/lib/firebase-admin";
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
} from "@/lib/security/admin-session";

const BATCH_SIZE = 400;

export async function DELETE(request: Request) {
  const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
  if (!verifyAdminSessionToken(token)) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return Response.json({ error: "Origen no permitido." }, { status: 403 });
  }

  try {
    let deleted = 0;
    while (true) {
      const snapshot = await adminDb
        .collection("surveyResponses")
        .limit(BATCH_SIZE)
        .get();
      if (snapshot.empty) break;

      const batch = adminDb.batch();
      snapshot.docs.forEach((document) => batch.delete(document.ref));
      await batch.commit();
      deleted += snapshot.size;
    }

    return Response.json({ deleted });
  } catch (error) {
    console.error("Unable to clear survey responses", error);
    return Response.json(
      { error: "No fue posible vaciar las encuestas." },
      { status: 500 },
    );
  }
}
