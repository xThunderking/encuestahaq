import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ATTENDANCE_SAVE_TIMEOUT_MS,
  createAttendanceRequestId,
  saveAttendance,
} from "@/modules/attendance/save-attendance";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("attendance writes with unreliable connections", () => {
  it("releases a hung request with a safe retry message", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener("abort", () =>
              reject(new DOMException("Aborted", "AbortError")),
            );
          }),
      ),
    );
    const rejected = expect(
      saveAttendance("POST", {
        doctorName: "Doctora",
        requestId: createAttendanceRequestId(),
      }),
    ).rejects.toThrow(/no duplicará/);
    await vi.advanceTimersByTimeAsync(ATTENDANCE_SAVE_TIMEOUT_MS);
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("never reports success for a proxy HTML response or incomplete JSON", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response("<html>Error</html>", { status: 502 }),
      )
      .mockResolvedValueOnce(Response.json({}));
    vi.stubGlobal("fetch", fetchMock);
    await expect(saveAttendance("POST", {})).rejects.toThrow(/confirmar/);
    await expect(saveAttendance("PATCH", {})).rejects.toThrow(/confirmar/);
  });

  it("preserves the server's duplicate ticket message", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: "Ese número de boleto ya está asignado a otro médico." },
            { status: 409 },
          ),
        ),
    );
    await expect(saveAttendance("PATCH", {})).rejects.toThrow(
      /ya está asignado/,
    );
  });
});
