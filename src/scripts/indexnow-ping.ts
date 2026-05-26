// import 없는 스크립트는 글로벌 스코프로 인식되어 다른 스크립트의 main()과
// "Duplicate function implementation" 충돌. export {}로 모듈화.
export {};

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

function buildUrlList(): string[] {
  const urls = new Set<string>();
  urls.add(`${BASE}/`);
  urls.add(`${BASE}/standings`);
  urls.add(`${BASE}/faq`);
  urls.add(`${BASE}/about`);
  for (const s of LEAGUE_SLUGS) urls.add(`${BASE}/league/${s}`);
  for (const s of PLATFORM_SLUGS) urls.add(`${BASE}/platform/${s}`);
  for (const s of STANDINGS_SLUGS) urls.add(`${BASE}/standings/${s}`);
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

main().catch((err) => {
  console.error("[indexnow] exception", err);
  process.exit(1);
});
