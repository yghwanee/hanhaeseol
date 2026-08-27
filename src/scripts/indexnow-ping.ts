import { pathToFileURL } from "node:url";
import { getAllGuides } from "@/lib/guides";
import standingsData from "@/data/standings.json";
import scheduleData from "@/data/schedule.json";
import archiveData from "@/data/schedule-archive.json";
import { buildTeamIndex, eligibleTeams, type StandingsData } from "@/lib/teams";
import { getTodayString } from "@/lib/schedule-utils";
import { eligibleSports } from "@/lib/sport-seo";
import type { ScheduleData } from "@/types/schedule";

/**
 * IndexNow ping — 검색엔진에 URL 변경을 즉시 통지.
 *
 * 지원: Bing, Yandex, Seznam, Naver(미지원이지만 IndexNow API 한 곳에 ping하면
 *       나머지로 자동 전파됨). Google은 IndexNow 미지원이라 sitemap에 의존.
 *
 * 호출 시점: crawl.yml에서 schedule.json 갱신 push + Vercel 빌드 READY 확인 직후.
 *   - 빌드 전에 ping하면 새 URL을 크롤할 때 아직 404일 수 있어 무의미.
 *
 * 키: public/a7c2f9e1b5d8c3f6e0a4b7c1d9e2f5a8.txt (사이트 소유 증명용, 공개 정보).
 *
 * Quota: per-host 약 10,000 URL/day.
 * 통지 대상 = 허브(리그·플랫폼·순위·종목·팀) + 가이드. **매치 페이지는 제외**한다
 * (2026-08-24 부터 robots.txt 가 `/match/` 를 막는다 — buildUrlList 안의 주석 참조).
 */

const KEY = "a7c2f9e1b5d8c3f6e0a4b7c1d9e2f5a8";
const HOST = "haeseol.com";
const BASE = `https://${HOST}`;
const KEY_LOCATION = `${BASE}/${KEY}.txt`;
const ENDPOINT = "https://api.indexnow.org/IndexNow";

// 핵심 정적 페이지 — slugs.ts / standings-seo.ts와 수동 동기화.
// 변경 빈도 낮아 수동 관리가 비용 < 자동 생성 빌드 의존성.
const LEAGUE_SLUGS = [
  "epl", "laliga", "bundesliga", "seriea", "ligue1",
  "champions-league", "europa-league", "conference-league",
  "mls", "k-league-1", "k-league-2", "afc-champions-league",
  "mlb", "kbo", "kbl",
];

const PLATFORM_SLUGS = [
  "spotv-now", "coupang-play", "tving", "apple-tv",
  "spotv", "spotv2", "tvn-sports", "kbs-n-sports",
  "mbc-sports-plus", "sbs-sports",
];

const STANDINGS_SLUGS = [
  "epl", "laliga", "bundesliga", "seriea", "ligue1",
  "champions-league", "europa-league", "mls",
  "k-league-1", "k-league-2", "eredivisie",
  "kbo", "mlb",
];

export function buildUrlList(): string[] {
  const urls = new Set<string>();
  urls.add(`${BASE}/`);
  urls.add(`${BASE}/standings`);
  urls.add(`${BASE}/faq`);
  urls.add(`${BASE}/about`);
  // 한국어 해설 허브 — 네이버에서 CTR 최상위인 "해설" 쿼리군의 착지 페이지.
  urls.add(`${BASE}/commentary`);
  urls.add(`${BASE}/commentary/stats`);
  for (const s of LEAGUE_SLUGS) urls.add(`${BASE}/league/${s}`);
  for (const s of PLATFORM_SLUGS) urls.add(`${BASE}/platform/${s}`);
  for (const s of STANDINGS_SLUGS) urls.add(`${BASE}/standings/${s}`);
  // 종목 허브 — 게이트는 sitemap·페이지와 동일(eligibleSports).
  for (const s of eligibleSports((scheduleData as unknown as ScheduleData).schedules, getTodayString())) {
    urls.add(`${BASE}/sport/${s.slug}`);
  }

  // 가이드(한해설 Topic) — 새 글 빠른 색인용. 수가 적어 quota 영향 없음.
  urls.add(`${BASE}/guide`);
  for (const g of getAllGuides()) urls.add(`${BASE}/guide/${g.slug}`);

  // 팀 페이지 — 색인이 가장 급한 대상인데 여기서 빠져 있었다(2026-07-28).
  // 시즌 내내 수요가 붙는 상시 엔티티라 한 번 색인되면 오래 일한다. 유럽 리그가
  // 개막하면 팀이 자동으로 늘어나므로 하드코딩하지 않고 실제 인덱스에서 뽑는다.
  //
  // 게이트는 sitemap·홈과 동일(eligibleTeams). **존재하지 않는 URL을 ping 하면
  // 크롤러가 404를 받고 신뢰도가 깎이므로** 실제 생성되는 페이지만 보낸다.
  for (const t of eligibleTeams(buildTeamIndex(standingsData as unknown as StandingsData), [
    ...(scheduleData as unknown as ScheduleData).schedules,
    ...(archiveData as unknown as ScheduleData).schedules,
  ])) {
    urls.add(`${BASE}/team/${encodeURIComponent(t.slug)}`);
  }

  // 🔴 매치 페이지는 통지하지 않는다(2026-08-24 결정과 한 쌍).
  //
  // `sitemap.ts` 의 `INCLUDE_MATCH_URLS = false` + `robots.txt` 의 `Disallow: /match/` 로
  // 매치 URL 을 크롤러에서 통째로 뺐다(Vercel Observability 실측: ISR Writes 의 96% 가
  // `/match/[slug]`, Write Utilization 0.1×, 색인 가치는 GSC 3개월 실측 0). 그런데 통지
  // 목록만 2026-08-19 버전 그대로 남아 **robots 가 막은 URL 을 계속 ping** 하고 있었다
  // (2026-08-27 발견 — `test:indexnow-coverage` 가 8/24부터 CI 를 빨갛게 만들고 있었다).
  //
  // 존재는 하지만 크롤 금지인 URL 을 통지하면 크롤러가 헛걸음을 하고 호스트 신뢰도가
  // 깎인다 — 이 스크립트가 원래 지키려던 규칙 그 자체다.
  //
  // 되살리려면 `INCLUDE_MATCH_URLS`·`robots.txt` 와 **함께** 되돌릴 것. 셋이 따로 놀면
  // 사이트맵·robots·IndexNow 가 같은 URL 에 서로 다른 신호를 낸다.
  return [...urls];
}

async function main() {
  const urlList = buildUrlList();
  const body = {
    host: HOST,
    key: KEY,
    keyLocation: KEY_LOCATION,
    urlList,
  };

  console.log(`[indexnow] ping ${urlList.length} URLs to ${ENDPOINT}`);

  // 목록만 확인하고 실제 통지는 하지 않는다. quota 를 태우지 않고 게이트 변경의
  // 영향을 재는 용도 — 잘못된 목록을 보내면 되돌릴 방법이 없다.
  if (process.env.INDEXNOW_DRY_RUN === "1") {
    const byType = new Map<string, number>();
    for (const u of urlList) {
      const seg = u.replace(BASE, "").split("/")[1] || "(root)";
      byType.set(seg, (byType.get(seg) ?? 0) + 1);
    }
    console.log("[indexnow] DRY RUN — 통지하지 않음");
    for (const [k, v] of [...byType].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k}: ${v}`);
    }
    return;
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });

  // IndexNow 응답 코드 (spec):
  //   200 OK - 모두 접수 (개별 검증은 비동기)
  //   202 Accepted - 접수, key 검증 진행 중
  //   400 Bad Request - 형식 오류
  //   403 Forbidden - key 검증 실패 (keyLocation에 키 파일 없음)
  //   422 Unprocessable - URL이 host와 매칭 안 됨
  //   429 Too Many Requests - quota 초과
  if (res.status === 200 || res.status === 202) {
    console.log(`[indexnow] ok status=${res.status}`);
    return;
  }

  const text = await res.text().catch(() => "");
  console.error(`[indexnow] FAILED status=${res.status} body=${text.slice(0, 500)}`);
  process.exit(1);
}

// 🔴 직접 실행일 때만 통지한다. top-level 에서 무조건 main() 을 부르면 이 파일을
// import 하는 것만으로 ping 이 나간다 — 가드 테스트를 붙이자마자 실제로 통지가
// 나갔고, 그대로 뒀으면 CI 가 커밋마다 검색엔진을 때렸을 자리다.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((err) => {
    console.error("[indexnow] exception", err);
    process.exit(1);
  });
}
