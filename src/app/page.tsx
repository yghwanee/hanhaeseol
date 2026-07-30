import Link from "next/link";
import { Schedule } from "@/types/schedule";
import { GAME_DURATION_HOURS, getTodayString } from "@/lib/schedule-utils";
import { loadScheduleData, loadTeamRecords, loadResults } from "@/lib/server-data";
import { ResultsData } from "@/types/results";
import ScheduleClient from "./ScheduleClient";
import { HomeAboutSection } from "./_components/HomeAboutSection";
import WeekHighlights from "./_components/WeekHighlights";
import { IntroAnimation } from "./_components/IntroAnimation";
import { INTRO_EMBLEM_PATHS } from "./_components/intro-emblems";
import { GuideCards } from "./_components/GuideCards";
import { getAllGuides } from "@/lib/guides";

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
        // logo.png 원본은 3496x3496 / 1.26MB 다. 구조화 데이터 이미지로 그걸 노출하면
        // 크롤러가 매번 1.26MB 를 받는다. 1200px 축소본(199KB)으로 충분하다
        // (구글 권장 1200px 이상 충족).
        "image": ["https://haeseol.com/logo-1200.png"],
        "description": `${s.league} ${s.homeTeam} vs ${s.awayTeam} ${s.platform} 중계${s.koreanCommentary === true ? " (한국어해설)" : ""}`,
        "sport": s.sport,
        "inLanguage": lang,
        // competitor 는 performer 와 완전 중복이라 제거(직렬화 42KB 중 ~8KB).
        // 구글 Event 리치결과 권장 필드는 performer 쪽이다.
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
 * 클라이언트로 직렬화되는 results를 홈에서 실제 조회 가능한 범위로 줄인다.
 * 홈 날짜 탭은 오늘~+7일이라 과거 경기 결과는 안 쓴다(과거 날짜는 datepicker →
 * archive lazy fetch 경로). results 배열은 디버깅·표시용이라 클라가 안 씀 → 비운다.
 */
function pruneResultsForClient(results: ResultsData | null): ResultsData | null {
  if (!results) return null;
  const todayStr = getTodayString();
  const byKey: ResultsData["byKey"] = {};
  for (const [key, r] of Object.entries(results.byKey)) {
    if (r.date >= todayStr) byKey[key] = r;
  }
  return { lastUpdated: results.lastUpdated, byKey, results: [] };
}

/** 홈은 프리렌더 + CDN 캐시로 서빙한다(엣지에서 즉시 = 흰 번쩍 방지의 근본 처방).
 *  searchParams 를 서버에서 읽으면 이 페이지가 동적 렌더로 강등돼 매 요청 함수가
 *  돌고 CDN 캐시가 통째로 꺼진다(no-store). 데이터(schedule.json 등)는 배포 번들
 *  안에 있어 동적 렌더로 얻는 신선도 이득도 0이었다. 딥링크 필터는 ScheduleClient
 *  가 마운트 후 location.search 로 읽는다.
 *
 *  revalidate 로 재생성 주기를 짧게 둬, 날짜가 바뀌는 자정(KST) 직후에도
 *  getTodayString() 기준 기본 선택일이 오래 어긋나지 않게 한다. */
export const revalidate = 60;

export default function Home() {
  const data = loadScheduleData();
  // 클라로 직렬화되는 teamRecords 를 화면(7일치)에 나오는 리그로 한정한다. 전 리그 풀맵을
  // 그대로 보내면 비시즌 리그(예: 여름의 EPL/라리가)까지 초기 HTML 에 박혀 낭비. 리그 단위로
  // 통째 보존하므로 lookupTeamRecord 의 league 내 normalize 폴백은 그대로 동작한다.
  const shownLeagues = new Set(data.schedules.map((s) => s.league));
  const teamRecords = Object.fromEntries(
    Object.entries(loadTeamRecords()).filter(([league]) => shownLeagues.has(league)),
  );
  const results = pruneResultsForClient(loadResults());
  const sportsEventsJsonLd = buildSportsEventsJsonLd(data.schedules);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(sportsEventsJsonLd) }}
      />
      {/* 인트로 엠블럼 프리로드 — 인트로가 뜨는 메인에서만. React 가 rel=preload
          링크를 head 로 호이스트한다. (layout 전역 프리로드는 다른 페이지 낭비라 제거) */}
      {INTRO_EMBLEM_PATHS.map((src) => (
        <link key={src} rel="preload" as="image" href={src} />
      ))}
      <IntroAnimation />
      <main>
        <ScheduleClient initialData={data} teamRecords={teamRecords} results={results} />

        <section className="mx-auto mt-4 sm:mt-6 max-w-2xl px-3 sm:px-4">
          <WeekHighlights
            title="이번 주 빅매치"
            schedules={data.schedules}
            days={7}
            emptyText="이번 주 한국어 해설 빅매치 정보가 아직 갱신되지 않았습니다."
          />
        </section>
        <section className="mx-auto mt-6 sm:mt-8 max-w-2xl px-3 sm:px-4">
          <GuideCards title="한해설 Topic" guides={getAllGuides().slice(0, 4)} />
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
