import "server-only";
import { createHash } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import {
  attendanceImportIdentity,
  type AttendanceImportRecord,
  type AttendanceImportResult,
} from "./import-contract";

const TRANSACTION_WRITE_LIMIT = 450;

export async function importAttendanceGuests(
  records: AttendanceImportRecord[],
): Promise<AttendanceImportResult> {
  const collection = adminDb.collection("medicalEventGuests");
  const entries = records.map((record) => {
    const identity = attendanceImportIdentity(record.doctorName);
    const id = `attendance-excel-${createHash("sha256").update(identity).digest("hex")}`;
    return { record, identity, reference: collection.doc(id) };
  });
  if (!entries.length) return { imported: 0, skipped: 0, total: 0 };
  let imported = 0;
  for (
    let offset = 0;
    offset < entries.length;
    offset += TRANSACTION_WRITE_LIMIT
  ) {
    const batch = entries.slice(offset, offset + TRANSACTION_WRITE_LIMIT);
    imported += await adminDb.runTransaction(async (transaction) => {
      const existing = await transaction.get(collection);
      const identities = new Set(
        existing.docs.map((document) => {
          const data = document.data();
          return attendanceImportIdentity(String(data.doctorName ?? ""));
        }),
      );
      // Stable IDs and a collection read keep repeated or concurrent uploads safe.
      const targets = await transaction.getAll(
        ...batch.map((entry) => entry.reference),
      );
      let batchImported = 0;
      batch.forEach((entry, index) => {
        if (identities.has(entry.identity) || targets[index].exists) return;
        transaction.create(entry.reference, {
          doctorName: entry.record.doctorName,
          hasTicket: entry.record.hasTicket,
          isExtra: false,
          ticketNumber: null,
          ticketNumberNormalized: null,
          checkedInAt: null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        identities.add(entry.identity);
        batchImported++;
      });
      return batchImported;
    });
  }
  return {
    imported,
    skipped: entries.length - imported,
    total: entries.length,
  };
}
