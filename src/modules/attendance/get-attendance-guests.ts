import { adminDb } from "@/lib/firebase-admin";

export type AttendanceGuest = {
  id: string;
  doctorName: string;
  hospital: string;
  hasTicket: boolean;
  ticketNumber: string | null;
  checkedInAt: string | null;
};

export async function getAttendanceGuests(): Promise<AttendanceGuest[]> {
  const snapshot = await adminDb
    .collection("medicalEventGuests")
    .orderBy("doctorName")
    .get();

  return snapshot.docs.map((document) => {
    const data = document.data();
    const checkedInAt = data.checkedInAt;

    return {
      id: document.id,
      doctorName: String(data.doctorName ?? ""),
      hospital: String(data.hospital ?? ""),
      hasTicket: data.hasTicket === true,
      ticketNumber:
        typeof data.ticketNumber === "string" ? data.ticketNumber : null,
      checkedInAt:
        checkedInAt && typeof checkedInAt.toDate === "function"
          ? checkedInAt.toDate().toISOString()
          : null,
    };
  });
}
