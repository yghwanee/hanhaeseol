import fs from "fs";
import path from "path";
import Link from "next/link";
import { ScheduleData, Schedule } from "@/types/schedule";
import ScheduleClient from "./ScheduleClient";

function buildSportsEventsJsonLd(schedules: Schedule[]) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcoming = schedules
    .filter((s) => s.date >= todayStr)
    .slice(0, 50);

  return {
    "@context": "https://schema.org",
    "@graph": upcoming.map((s) => {
      const [hh, mm] = s.time.split(":");
      const startDate = `${s.date}T${hh}:${mm}:00+09:00`;
      return {
        "@type": "SportsEvent",
        "name": `${s.homeTeam} vs ${s.awayTeam}`,
        "startDate": startDate,
        "sport": s.sport,
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/OnlineEventAttendanceMode",
        "location": {
          "@type": "VirtualLocation",
          "url": "https://haeseol.com",
        },
        "competitor": [
          { "@type": "SportsTeam", "name": s.homeTeam },
          { "@type": "SportsTeam", "name": s.awayTeam },
        ],
        "superEvent": { "@type": "SportsEvent", "name": s.league },
        "broadcastOfEvent": {
          "@type": "BroadcastEvent",
          "name": s.platform,
          "isLiveBroadcast": true,
          "inLanguage": s.koreanCommentary === true ? "ko" : s.koreanCommentary === false ? "en" : "ko",
        },
        "description": `${s.league} ${s.homeTeam} vs ${s.awayTeam} ${s.platform} 중계${s.koreanCommentary === true ? " (한국어해설)" : ""}`,
      };
    }),
  };
}

export default function Home() {
  const filePath = path.join(process.cwd(), "public", "schedule.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  const data: ScheduleData = JSON.parse(raw);
  const sportsEventsJsonLd = buildSportsEventsJsonLd(data.schedules);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(sportsEventsJsonLd) }}
      />
      <main>
        <ScheduleClient initialData={data} />
      </main>
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
