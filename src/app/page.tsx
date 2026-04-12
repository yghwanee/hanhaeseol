import fs from "fs";
import path from "path";
import Link from "next/link";
import { ScheduleData } from "@/types/schedule";
import ScheduleClient from "./ScheduleClient";

export default function Home() {
  const filePath = path.join(process.cwd(), "public", "schedule.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const data: ScheduleData = JSON.parse(raw);

  return (
    <>
      <ScheduleClient initialData={data} />
      <footer className="border-t border-zinc-800 py-6 px-4 text-center text-xs text-gray-500">
        <div className="flex justify-center gap-4 mb-2">
          <Link href="/about" className="hover:text-gray-300">한해설 소개</Link>
          <Link href="/privacy" className="hover:text-gray-300">개인정보처리방침</Link>
          <Link href="/terms" className="hover:text-gray-300">이용약관</Link>
        </div>
        <p>&copy; 2026 한해설. All rights reserved.</p>
      </footer>
    </>
  );
}
