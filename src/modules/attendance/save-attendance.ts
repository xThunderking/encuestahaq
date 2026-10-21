export const ATTENDANCE_SAVE_TIMEOUT_MS = 25_000;

type SaveResult = {
  id?: string;
  registered?: boolean;
  alreadyRegistered?: boolean;
  error?: string;
};

export function createAttendanceRequestId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0"));
  return [
    hex.slice(0, 4).join(""),
    hex.slice(4, 6).join(""),
    hex.slice(6, 8).join(""),
    hex.slice(8, 10).join(""),
    hex.slice(10).join(""),
  ].join("-");
}

export async function saveAttendance(
  method: "POST" | "PATCH",
  payload: Record<string, unknown>,
): Promise<SaveResult> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    ATTENDANCE_SAVE_TIMEOUT_MS,
  );
  try {
    const response = await fetch("/api/admin/attendance", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const result = (await response
      .json()
      .catch(() => null)) as SaveResult | null;
    if (!response.ok || !result || typeof result !== "object")
      throw new Error(
        result?.error ??
          "No pudimos confirmar el registro. Inténtalo nuevamente.",
      );
    if (
      (method === "POST" && typeof result.id !== "string") ||
      (method === "PATCH" && typeof result.registered !== "boolean")
    )
      throw new Error(
        "No pudimos confirmar el registro. Inténtalo nuevamente.",
      );
    return result;
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(
        "No pudimos confirmar el registro a tiempo. Revisa tu conexión y vuelve a intentarlo; el reintento no duplicará el registro.",
      );
    if (error instanceof TypeError)
      throw new Error("Revisa tu conexión y vuelve a intentar el registro.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
