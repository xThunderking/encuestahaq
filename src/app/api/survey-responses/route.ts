import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
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
    const response = await prisma.surveyResponse.upsert({
      where: { submissionId: result.data.submissionId },
      update: {},
      create: {
        submissionId: result.data.submissionId,
        surveyCode: result.data.surveyCode,
        locale: result.data.locale,
        answers: result.data.answers as Prisma.InputJsonValue,
      },
      select: { id: true, submittedAt: true },
    });

    return Response.json(response, { status: 201 });
  } catch (error) {
    console.error("Unable to save survey response", error);
    return Response.json(
      { error: "No fue posible guardar la encuesta." },
      { status: 500 },
    );
  }
}
