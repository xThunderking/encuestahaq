import {
  attendanceGuestsQuery,
  serializeAttendanceGuest,
} from "@/modules/attendance/get-attendance-guests";
import { createAttendanceStream } from "@/modules/attendance/attendance-stream";
import { shareAttendanceSubscription } from "@/modules/attendance/shared-attendance-subscription";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const subscribe = shareAttendanceSubscription((onGuests, onError) =>
  attendanceGuestsQuery().onSnapshot(
    (snapshot) => onGuests(snapshot.docs.map(serializeAttendanceGuest)),
    onError,
  ),
);

export function GET(request: Request) {
  const stream = createAttendanceStream(request.signal, subscribe);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "private, no-store, no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
