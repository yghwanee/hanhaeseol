import Link from "next/link";
import { Schedule } from "@/types/schedule";
import { GAME_DURATION_HOURS } from "@/lib/schedule-utils";
import { loadScheduleData, loadTeamRecords, loadResults, loadResultsArchive } from "@/lib/server-data";
import { ResultsData } from "@/types/results";
import ScheduleClient from "./ScheduleClient";
import { HomeAboutSection } from "./_components/HomeAboutSection";
import WeekHighlights from "./_components/WeekHighlights";
import { IntroAnimation } from "./_components/IntroAnimation";

function buildSportsEventsJsonLd(schedules: Schedule[]) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcoming = schedules
    .filter((s) => s.date >= todayStr)
    .slice(0, 50);

  return {
    "@context": "https://schema.org",
    "@graph": upcoming.map((s) => {
      const [hh, mm] = s.time.split(":");
      const start = new Date(`${s.date}T${hh}:${mm}:00+09:00`);
      const durationMs = (GAME_DURATION_HOURS[s.sport] ?? 3) * 60 * 60 * 1000;
      const end = new Date(start.getTime() + durationMs);
      const lang = s.koreanCommentary === true ? "ko" : s.koreanCommentary === false ? "en" : "ko";

      return {
        "@type": "SportsEvent",
        "name": `${s.league} ${s.homeTeam} vs ${s.awayTeam}`,
        "startDate": start.toISOString(),
        "endDate": end.toISOString(),
        "eventStatus": "https://schema.org/EventScheduled",
        "eventAttendanceMode": "https://schema.org/OnlineEventAttendanceMode",
        "location": {
          "@type": "VirtualLocation",
          "url": "https://haeseol.com",
        },
        "image": ["https://haeseol.com/logo.png"],
        "description": `${s.league} ${s.homeTeam} vs ${s.awayTeam} ${s.platform} 중계${s.koreanCommentary === true ? " (한국어해설)" : ""}`,
        "sport": s.sport,
        "inLanguage": lang,
        "competitor": [
          { "@type": "SportsTeam", "name": s.homeTeam },
          { "@type": "SportsTeam", "name": s.awayTeam },
        ],
        "performer": [
          { "@type": "SportsTeam", "name": s.homeTeam },
          { "@type": "SportsTeam", "name": s.awayTeam },
        ],
        "organizer": {
          "@type": "Organization",
          "name": s.league,
        },
        "offers": {
          "@type": "Offer",
          "url": "https://haeseol.com",
          "availability": "https://schema.org/InStock",
          "price": "0",
          "priceCurrency": "KRW",
          "validFrom": new Date(s.date).toISOString(),
        },
      };
    }),
  };
}

/**
 * 월드컵 과거 스코어 채우기: results.json은 3일 윈도우라 대회 초반 경기 스코어가 빠진다.
 * 영구 누적 아카이브에서 categoryId=worldcup 결과만 골라 results.byKey의 베이스로 깔고,
 * 그 위에 최신 results.json을 덮어써 라이브/당일 경기는 신선한 상태를 유지한다.
 * (월드컵은 팀명이 네이버와 정확히 일치해 alias 없이 byKey 매칭됨 — lookup.ts 참고)
 */
function mergeWorldcupArchive(
  results: ResultsData | null,
  archive: ResultsData | null,
): ResultsData | null {
  if (!archive) return results;
  const wcByKey: Record<string, ResultsData["results"][number]> = {};
  for (const [key, r] of Object.entries(archive.byKey)) {
    if (r.categoryId === "worldcup") wcByKey[key] = r;
  }
  if (Object.keys(wcByKey).length === 0) return results;
  if (!results) {
    return { lastUpdated: archive.lastUpdated, byKey: wcByKey, results: [] };
  }
  return { ...results, byKey: { ...wcByKey, ...results.byKey } };
}

export default function Home({
  searchParams,
}: {
  searchParams: {
    date?: string;
    sport?: string;
    platform?: string;
    comm?: string;
  };
}) {
  const data = loadScheduleData();
  const teamRecords = loadTeamRecords();
  const results = mergeWorldcupArchive(loadResults(), loadResultsArchive());
  const sportsEventsJsonLd = buildSportsEventsJsonLd(data.schedules);
  const initialCommentary: "all" | "korean" | "foreign" =
    searchParams.comm === "korean" || searchParams.comm === "foreign" ? searchParams.comm : "all";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(sportsEventsJsonLd) }}
      />
      <IntroAnimation />
      <main>
        <ScheduleClient
          initialData={data}
          teamRecords={teamRecords}
          results={results}
          initialDate={searchParams.date}
          initialSport={searchParams.sport}
          initialPlatform={searchParams.platform}
          initialCommentary={initialCommentary}
        />
        <section className="mx-auto mt-4 sm:mt-6 max-w-2xl px-3 sm:px-4">
          <WeekHighlights
            title="이번 주 빅매치"
            schedules={data.schedules}
            days={7}
            emptyText="이번 주 한국어 해설 빅매치 정보가 아직 갱신되지 않았습니다."
          />
        </section>
        <HomeAboutSection />
      </main>
      <footer className="mt-8 border-t border-zinc-800 py-6 px-4 text-center text-xs text-gray-500">
        <div className="flex flex-wrap justify-center gap-4 mb-2">
          <Link href="/standings" className="hover:text-gray-300">팀 순위</Link>
          <Link href="/about" className="hover:text-gray-300">한해설 소개</Link>
          <Link href="/faq" className="hover:text-gray-300">자주 묻는 질문</Link>
          <Link href="/privacy" className="hover:text-gray-300">개인정보처리방침</Link>
          <Link href="/terms" className="hover:text-gray-300">이용약관</Link>
        </div>
        <p>&copy; 2026 한해설. All rights reserved.</p>
      </footer>
    </>
  );
}
