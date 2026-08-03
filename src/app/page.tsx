import { Schedule, ScheduleData } from "@/types/schedule";
import { GAME_DURATION_HOURS, getTodayString } from "@/lib/schedule-utils";
import { loadScheduleData, loadTeamRecords, loadResults } from "@/lib/server-data";
import { ResultsData } from "@/types/results";
import ScheduleClient from "./ScheduleClient";
import { IntroAnimation } from "./_components/IntroAnimation";
import { INTRO_EMBLEM_PATHS } from "./_components/intro-emblems";

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

/**
 * 클라이언트로 직렬화되는 편성을 홈 날짜 탭 범위(오늘~+6일)로 줄인다.
 *
 * `loadScheduleData()` 는 `schedule.json`(7일치, 46KB)에 `worldcup.json`(104경기, 49.5KB)을
 * 합쳐서 돌려준다. 월드컵은 이미 끝난 대회(~2026-07-20)라 홈 기본 뷰에 **한 경기도** 안 걸리는데
 * 초기 HTML 에는 통째로 실려 있었다 — 편성표 본체보다 큰 죽은 무게다.
 * 과거 날짜(archive 모드)에서만 필요하므로, schedule-archive.json 과 같은 지연 fetch 로 옮긴다.
 *
 * 날짜 기준으로 자르므로 리그명에 의존하지 않는다 — 다음 대회가 생겨 worldcup.json 에
 * 미래 경기가 들어오면 그건 그대로 통과한다.
 */
function pruneSchedulesForClient(data: ScheduleData): ScheduleData {
  const todayStr = getTodayString();
  return { ...data, schedules: data.schedules.filter((s) => s.date >= todayStr) };
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
  const clientData = pruneSchedulesForClient(data);
  // 클라로 직렬화되는 teamRecords 를 화면(7일치)에 나오는 리그로 한정한다. 전 리그 풀맵을
  // 그대로 보내면 비시즌 리그(예: 여름의 EPL/라리가)까지 초기 HTML 에 박혀 낭비. 리그 단위로
  // 통째 보존하므로 lookupTeamRecord 의 league 내 normalize 폴백은 그대로 동작한다.
  // (기준은 클라로 실제 나가는 목록 — 끝난 대회 리그까지 세면 다시 죽은 무게가 붙는다.)
  const shownLeagues = new Set(clientData.schedules.map((s) => s.league));
  const teamRecords = Object.fromEntries(
    Object.entries(loadTeamRecords()).filter(([league]) => shownLeagues.has(league)),
  );
  const results = pruneResultsForClient(loadResults());
  // JSON-LD 는 원본(data)에서 만든다 — 자체적으로 오늘 이후만 고르므로 결과는 같고,
  // 앞으로 미래 대회가 worldcup.json 으로 들어와도 색인에서 빠지지 않는다.
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
      {/* 홈 본문은 편성표 하나로 끝난다.
          종전엔 편성표 아래로 "이번 주 빅매치" → "한해설 Topic" → 서비스 소개(한해설이란?·
          지원 종목·지원 플랫폼·리그별·팀별·이용 가이드·자주 묻는 질문)가 이어져 스크롤이 길었다.
          전부 걷어내되 **내부 링크는 잃지 않도록** 리그·플랫폼 허브를 전역 푸터(`SiteFooter`)로
          옮겼다. 나머지는 이미 다른 곳에 같은 내용이 있어 중복이었다:
          "한해설이란?"·이용 가이드 = `/about`, 자주 묻는 질문 = `/faq`(질문 세트가 더 많다),
          "이번 주 빅매치" = 편성표 카드가 이미 경기마다 매치 페이지로 링크한다(중복 링크),
          팀 링크 85개 = 순위표 팀 링크와 매치 페이지 팀 태그.
          홈에 있던 FAQPage JSON-LD 도 함께 사라지는데, `/faq` 가 자기 세트로 이미 내보내므로
          같은 사이트에서 두 벌이 도는 상태가 정리된 것이다. */}
      <main>
        <ScheduleClient
          initialData={clientData}
          teamRecords={teamRecords}
          results={results}
        />
      </main>
    </>
  );
}
