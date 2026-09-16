import { Schedule, ScheduleData } from "@/types/schedule";
import { GAME_DURATION_HOURS, getTodayString } from "@/lib/schedule-utils";
import { loadScheduleData, loadTeamRecords, loadResults } from "@/lib/server-data";
import { ResultsData } from "@/types/results";
import ScheduleClient from "./ScheduleClient";
import { IntroAnimation } from "./_components/IntroAnimation";
import { NotifyIntroModal } from "./_components/NotifyIntroModal";
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
 *  🔴 revalidate 는 2026-08-18 에 60 → 3600 으로 올렸다. Vercel Hobby 계정이
 *  한도 초과로 잠겼는데(Fluid Active CPU 12h21m/4h · ISR Writes 311K/200K ·
 *  Fast Origin Transfer 12.63/10GB) 세 수치가 전부 "한 달 약 43,000회"로 수렴했고,
 *  그게 정확히 60초마다 도는 이 홈 재생성 횟수(1,440/일 × 30일)다.
 *  홈 HTML 305KB × 43,200 ≈ 12.6GB 로 Origin Transfer 와도 맞아떨어진다.
 *
 *  그리고 그 재생성은 **아무 이득이 없었다** — schedule.json 등 데이터는 배포 번들
 *  안에 있어서 재생성해도 같은 HTML 이 다시 나온다. 신선도는 배포가 만든다.
 *  자정(KST) 날짜 넘김은 ①KST 00:10 예약 배포(deploy.yml)가 캐시를 갈아주고
 *  ②ScheduleClient 가 마운트 때 getTodayString() 으로 다시 고르므로 화면은 정확하다.
 *
 *  ═══ revalidate 정책 정본 (2026-09-16, 3600 → 21600) ═══
 *  🔴 3600 도 여전히 같은 HTML 을 시간당 다시 굽고 있었다. 623페이지가 전부 3600 이라
 *  이론상 한 달 44.8만 회 재생성이고, 대시보드 실측이 ISR Writes 244,795/200,000 이었다.
 *  팀 페이지는 렌더당 CPU 860ms 라 Active CPU(8h33m/4h)도 같은 뿌리다.
 *
 *  그래서 값을 **배포 주기에 맞춘다**. `deploy.yml` 이 KST 00:10·06:10·12:10·18:10
 *  하루 4번 배포하고, 배포는 generateStaticParams 페이지를 전부 다시 굽는다.
 *  6h(21600) = 그 간격과 같은 값이라 실제로는 거의 발화하지 않는 안전망이 된다.
 *
 *  분류 규칙 — 새 페이지를 만들 때 이 둘 중 하나를 고른다.
 *   · 서버 렌더가 `getTodayString()`·`new Date()`·`isGameFinished()` 를 쓴다 → **21600**
 *     (홈·league·platform·sport·team·commentary·asian-games. 종료 뱃지가 최대 6h 늦는다)
 *   · 안 쓴다 → **false** (commentary/stats. 배포 전까지 바이트가 안 변한다)
 *   · guide·faq·about·standings 는 애초에 `revalidate` 선언이 없다 = 이미 완전 정적.
 *
 *  🔴 값을 다시 짧게 돌리지 말 것. `npm run test:revalidate-budget` 가 막는다. */
export const revalidate = 21600;

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
      {/* 🔴 첫 방문 안내(찜하면 경기 알림이 온다)는 **홈에만** 둔다(화니 결정, 2026-09-15).
       *  별이 있는 화면이 편성표라 닫자마자 눌러 볼 수 있고, 네이버 검색으로 가이드 글에
       *  바로 들어온 사람에게는 맥락 없는 모달이 이탈만 만든다. 인트로가 끝난 뒤 뜬다. */}
      <NotifyIntroModal />
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
