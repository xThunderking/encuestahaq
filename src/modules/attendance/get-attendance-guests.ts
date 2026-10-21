import { adminDb } from "@/lib/firebase-admin";
import type { DocumentSnapshot } from "firebase-admin/firestore";

export type AttendanceGuest = {
  id: string;
  doctorName: string;
  /** Legacy field accepted for existing fixtures; never read or returned. */
  hospital?: string;
  isExtra?: boolean;
  hasTicket: boolean;
  ticketNumber: string | null;
  checkedInAt: string | null;
};

export function attendanceGuestsQuery() {
  return adminDb.collection("medicalEventGuests").orderBy("doctorName");
}

export function serializeAttendanceGuest(
  document: DocumentSnapshot,
): AttendanceGuest {
  const data = document.data() ?? {};
  const checkedInAt = data.checkedInAt;

  return {
    id: document.id,
    doctorName: String(data.doctorName ?? ""),
    isExtra: data.isExtra === true,
    hasTicket: data.hasTicket === true,
    ticketNumber:
      typeof data.ticketNumber === "string" ? data.ticketNumber : null,
    checkedInAt:
      checkedInAt && typeof checkedInAt.toDate === "function"
        ? checkedInAt.toDate().toISOString()
        : null,
  };
}

export async function getAttendanceGuests(): Promise<AttendanceGuest[]> {
  const snapshot = await attendanceGuestsQuery().get();
  return snapshot.docs.map(serializeAttendanceGuest);
}
