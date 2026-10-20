import { describe, expect, it, vi } from "vitest";
const { onSnapshot, orderBy, collection } = vi.hoisted(() => {
  const onSnapshot = vi.fn();
  const orderBy = vi.fn(() => ({ onSnapshot }));
  const collection = vi.fn(() => ({ orderBy }));
  return { onSnapshot, orderBy, collection };
});
vi.mock("@/lib/firebase-admin", () => ({ adminDb: { collection } }));
import { GET } from "@/app/api/admin/attendance/stream/route";

describe("Firestore attendance stream route", () => {
  it("subscribes to the existing collection, serializes server dates and detaches on abort", async () => {
    const unsubscribe = vi.fn();
    onSnapshot.mockImplementationOnce((next) => {
      next({
        docs: [
          {
            id: "doctor-1",
            data: () => ({
              doctorName: "Ana Martínez",
              hospital: "HAQ",
              hasTicket: true,
              ticketNumber: "0123",
              checkedInAt: { toDate: () => new Date("2026-10-19T15:00:00Z") },
            }),
          },
        ],
      });
      return unsubscribe;
    });
    const abort = new AbortController();
    const response = GET(
      new Request("http://localhost/api/admin/attendance/stream", {
        signal: abort.signal,
      }),
    );
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(response.headers.get("Cache-Control")).toContain("no-transform");
    expect(collection).toHaveBeenCalledWith("medicalEventGuests");
    expect(orderBy).toHaveBeenCalledWith("doctorName");
    const reader = response.body!.getReader();
    await reader.read();
    const message = new TextDecoder().decode((await reader.read()).value);
    expect(message).toContain('"checkedInAt":"2026-10-19T15:00:00.000Z"');
    expect(message).toContain('"ticketNumber":"0123"');
    abort.abort();
    expect((await reader.read()).done).toBe(true);
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
