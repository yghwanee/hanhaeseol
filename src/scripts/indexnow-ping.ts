import { pathToFileURL } from "node:url";
import { getAllGuides } from "@/lib/guides";
import standingsData from "@/data/standings.json";
import scheduleData from "@/data/schedule.json";
import archiveData from "@/data/schedule-archive.json";
import resultsArchiveData from "@/data/results-archive.json";
import { buildTeamIndex, eligibleTeams, type StandingsData } from "@/lib/teams";
import { matchToSlug } from "@/lib/match-slug";
import { isRichMatch } from "@/lib/match-quality";
import { dedupeReversedFixtures } from "@/lib/fixture-dedupe";
import { getTodayString } from "@/lib/schedule-utils";
import type { Schedule, ScheduleData } from "@/types/schedule";
import type { ResultsData } from "@/types/results";

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
 * Quota: per-host 약 10,000 URL/day. 정적 핵심 페이지(~30개)만 보내면 충분.
 * 매치 페이지 수천개 일괄 ping은 묶음3(sitemap 분할) 단계에서 신규 매치 diff로
 * 좁혀서 추가 예정.
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
  for (const s of LEAGUE_SLUGS) urls.add(`${BASE}/league/${s}`);
  for (const s of PLATFORM_SLUGS) urls.add(`${BASE}/platform/${s}`);
  for (const s of STANDINGS_SLUGS) urls.add(`${BASE}/standings/${s}`);
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

  // 예정 경기 매치 페이지 — 여기서 빠져 있었다(2026-08-19까지).
  //
  // 근거: GA4 28일 실측에서 **Bing 171세션 / Google 66세션**으로 빙이 구글의 2.6배다.
  // 빙은 IndexNow 를 실제로 크롤 신호로 쓰는데, 정작 매일 새로 생기는 URL(매치)이
  // 통지 목록에 없었다. 구글은 IndexNow 를 안 쓰므로 sitemap 이 계속 담당한다.
  //
  // **오늘 이후 경기만** 보낸다. 과거 경기는 URL 이 안 바뀌고 이미 통지된 것이라
  // 매번 다시 보내면 quota(호스트당 약 10,000/일)만 태우고 신호도 흐려진다.
  //
  // 게이트는 sitemap 과 동일해야 한다 — dedupeReversedFixtures → 슬러그 묶기 →
  // isRichMatch. **존재하지 않거나 noindex 인 URL 을 ping 하면 크롤러가 404·noindex 를
  // 받고 신뢰도가 깎인다**(팀 페이지에서 이미 지킨 규칙).
  const today = getTodayString();
  const bySlug = new Map<string, Schedule>();
  for (const s of dedupeReversedFixtures([
    ...(scheduleData as unknown as ScheduleData).schedules,
    ...(archiveData as unknown as ScheduleData).schedules,
  ])) {
    const slug = matchToSlug(s);
    if (!bySlug.has(slug)) bySlug.set(slug, s);
  }
  const resultsArchive = resultsArchiveData as unknown as ResultsData;
  for (const [slug, s] of bySlug) {
    if (s.date < today) continue;
    if (!isRichMatch(s, resultsArchive)) continue;
    urls.add(`${BASE}/match/${encodeURIComponent(slug)}`);
  }

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
