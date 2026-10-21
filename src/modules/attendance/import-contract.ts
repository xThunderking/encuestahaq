export const MAX_IMPORT_ROWS = 570;
export const MAX_IMPORT_FILE_BYTES = 2 * 1024 * 1024;
export const IMPORT_HEADERS = ["NOMBRE DEL MEDICO", "BOLETO"] as const;

export type AttendanceImportRecord = {
  doctorName: string;
  hasTicket: boolean;
};
export type AttendanceImportIssue = { row: number; message: string };
export type AttendanceImportResult = {
  imported: number;
  skipped: number;
  total: number;
};

export function normalizeImportText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function attendanceImportIdentity(doctorName: string) {
  return normalizeImportText(doctorName);
}
