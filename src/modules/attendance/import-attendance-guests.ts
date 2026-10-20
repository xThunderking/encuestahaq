import "server-only";
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import {
  attendanceImportIdentity,
  type AttendanceImportRecord,
  type AttendanceImportResult,
} from "./import-contract";

export async function importAttendanceGuests(
  records: AttendanceImportRecord[],
): Promise<AttendanceImportResult> {
  const collection = adminDb.collection("medicalEventGuests");
  const entries = records.map((record) => {
    const identity = attendanceImportIdentity(
      record.doctorName,
      record.hospital,
    );
    const id = `attendance-excel-${createHash("sha256").update(identity).digest("hex")}`;
    return { record, identity, reference: collection.doc(id) };
  });
  if (!entries.length) return { imported: 0, skipped: 0, total: 0 };
  return adminDb.runTransaction(async (transaction) => {
    const existing = await transaction.get(collection);
    const identities = new Set(
      existing.docs.map((document) => {
        const data = document.data();
        return attendanceImportIdentity(
          String(data.doctorName ?? ""),
          String(data.hospital ?? ""),
        );
      }),
    );
    // Read stable IDs as well, so concurrent uploads of the same doctors retry safely.
    const targets = await transaction.getAll(
      ...entries.map((entry) => entry.reference),
    );
    let imported = 0;
    entries.forEach((entry, index) => {
      if (identities.has(entry.identity) || targets[index].exists) return;
      transaction.create(entry.reference, {
        ...entry.record,
        isExtra: false,
        ticketNumber: null,
        ticketNumberNormalized: null,
        checkedInAt: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      identities.add(entry.identity);
      imported++;
    });
    return {
      imported,
      skipped: entries.length - imported,
      total: entries.length,
    };
  });
}
