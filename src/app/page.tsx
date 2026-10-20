import AttendanceTable from "@/components/attendance/attendance-table";
import { getAttendanceGuests } from "@/modules/attendance/get-attendance-guests";

export const dynamic = "force-dynamic";

export default async function Home() {
  const guests = await getAttendanceGuests();

  return (
    <main className="min-h-screen bg-slate-50">
      <AttendanceTable initialGuests={guests} />
    </main>
  );
}
