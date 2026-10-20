import type { AttendanceGuest } from "./get-attendance-guests";

type Subscribe = (
  onGuests: (guests: AttendanceGuest[]) => void,
  onError: (error: Error) => void,
) => () => void;

// Rotate before the server's request timeout; EventSource reconnects with a full snapshot.
export const STREAM_LIFETIME_MS = 240_000;
export const STREAM_HEARTBEAT_MS = 15_000;

export function createAttendanceStream(
  signal: AbortSignal,
  subscribe: Subscribe,
) {
  const encoder = new TextEncoder();
  let dispose = () => {};

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let unsubscribe: (() => void) | undefined;

      const close = (cancelled = false) => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        clearTimeout(rotation);
        signal.removeEventListener("abort", abort);
        unsubscribe?.();
        if (!cancelled) controller.close();
      };
      const abort = () => close();
      dispose = () => close(true);
      const send = (message: string) => {
        if (!closed) controller.enqueue(encoder.encode(message));
      };
      const heartbeat = setInterval(() => {
        send("event: heartbeat\ndata: {}\n\n");
      }, STREAM_HEARTBEAT_MS);
      const rotation = setTimeout(() => close(), STREAM_LIFETIME_MS);
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) {
        close();
        return;
      }
      send("retry: 2000\n\n");

      try {
        unsubscribe = subscribe(
          (guests) =>
            send(`event: guests\ndata: ${JSON.stringify(guests)}\n\n`),
          (error) => {
            console.error("Attendance stream unavailable", error);
            close();
          },
        );
        // A subscription can fail or abort synchronously before returning its cleanup.
        if (closed) unsubscribe();
      } catch (error) {
        console.error("Unable to subscribe to attendance", error);
        close();
      }
    },
    cancel() {
      dispose();
    },
  });
}
