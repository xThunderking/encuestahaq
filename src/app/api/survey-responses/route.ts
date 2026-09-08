import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { surveyResponseSchema } from "@/lib/validation/survey-response";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Solicitud no valida." }, { status: 400 });
  }

  const result = surveyResponseSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: "Las respuestas no tienen un formato valido." },
      { status: 400 },
    );
  }

  try {
    const { submissionId, surveyCode, locale, answers } = result.data;
    const ref = adminDb.collection("surveyResponses").doc(submissionId);
    await ref.create({
      submissionId,
      surveyCode,
      locale,
      answers,
      submittedAt: FieldValue.serverTimestamp(),
    });

    return Response.json(
      { id: submissionId, submittedAt: new Date().toISOString() },
      { status: 201 },
    );
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === 6
    ) {
      return Response.json(
        { error: "La encuesta ya fue registrada." },
        { status: 409 },
      );
    }
    console.error("Unable to save survey response", error);
    return Response.json(
      { error: "No fue posible guardar la encuesta." },
      { status: 500 },
    );
  }
}
