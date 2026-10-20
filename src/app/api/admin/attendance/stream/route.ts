import {
  attendanceGuestsQuery,
  serializeAttendanceGuest,
} from "@/modules/attendance/get-attendance-guests";
import { createAttendanceStream } from "@/modules/attendance/attendance-stream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export function GET(request: Request) {
  const stream = createAttendanceStream(request.signal, (onGuests, onError) =>
    attendanceGuestsQuery().onSnapshot(
      (snapshot) => onGuests(snapshot.docs.map(serializeAttendanceGuest)),
      onError,
    ),
  );

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "private, no-store, no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
