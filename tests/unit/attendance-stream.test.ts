import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAttendanceStream,
  STREAM_HEARTBEAT_MS,
  STREAM_LIFETIME_MS,
} from "@/modules/attendance/attendance-stream";
import type { AttendanceGuest } from "@/modules/attendance/get-attendance-guests";

const guest: AttendanceGuest = {
  id: "doctor-1",
  doctorName: "Ana Martínez",
  hospital: "HAQ",
  hasTicket: true,
  ticketNumber: null,
  checkedInAt: null,
};
const decode = (chunk: ReadableStreamReadResult<Uint8Array>) =>
  new TextDecoder().decode(chunk.value);

describe("attendance SSE lifecycle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("delivers the same change immediately to five connected computers and detaches them", async () => {
    const listeners: ((guests: AttendanceGuest[]) => void)[] = [];
    const detach = Array.from({ length: 5 }, () => vi.fn());
    const readers = detach.map((unsubscribe) =>
      createAttendanceStream(new AbortController().signal, (onGuests) => {
        listeners.push(onGuests);
        onGuests([guest]);
        return unsubscribe;
      }).getReader(),
    );
    for (const reader of readers) {
      expect(decode(await reader.read())).toContain("retry: 2000");
      expect(decode(await reader.read())).toContain('"checkedInAt":null');
    }
    const updated = {
      ...guest,
      ticketNumber: "0248",
      checkedInAt: "2026-10-19T15:00:00.000Z",
    };
    listeners.forEach((notify) => notify([updated]));
    for (const reader of readers) {
      const message = decode(await reader.read());
      expect(message).toBe(
        `event: guests\ndata: ${JSON.stringify([updated])}\n\n`,
      );
      await reader.cancel();
    }
    detach.forEach((unsubscribe) => expect(unsubscribe).toHaveBeenCalledOnce());
    expect(vi.getTimerCount()).toBe(0);
  });

  it("sends heartbeats and releases the listener when the browser disconnects", async () => {
    const abort = new AbortController();
    const unsubscribe = vi.fn();
    const reader = createAttendanceStream(
      abort.signal,
      () => unsubscribe,
    ).getReader();
    await reader.read();
    await vi.advanceTimersByTimeAsync(STREAM_HEARTBEAT_MS);
    expect(decode(await reader.read())).toContain("event: heartbeat");
    abort.abort();
    expect((await reader.read()).done).toBe(true);
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("renews a long connection before the request timeout", async () => {
    const unsubscribe = vi.fn();
    const reader = createAttendanceStream(
      new AbortController().signal,
      () => unsubscribe,
    ).getReader();
    await reader.read();
    await vi.advanceTimersByTimeAsync(STREAM_LIFETIME_MS);
    while (!(await reader.read()).done) {
      /* drain queued heartbeats */
    }
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cleans up even when subscription setup fails synchronously", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const unsubscribe = vi.fn();
    const reader = createAttendanceStream(
      new AbortController().signal,
      (_notify, fail) => {
        fail(new Error("unavailable"));
        return unsubscribe;
      },
    ).getReader();
    await reader.read();
    expect((await reader.read()).done).toBe(true);
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
