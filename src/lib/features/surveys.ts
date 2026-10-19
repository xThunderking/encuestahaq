import { notFound } from "next/navigation";

export const surveysEnabled = process.env.ENABLE_SURVEYS === "true";

export function requireSurveysEnabled() {
  if (!surveysEnabled) notFound();
}

export function surveysDisabledResponse() {
  return Response.json(
    { error: "El sistema de encuestas está temporalmente desactivado." },
    { status: 404 },
  );
}
