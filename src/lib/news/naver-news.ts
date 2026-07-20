/**
 * 네이버 뉴스 검색 API — 주간 글감 재료 수집.
 *
 * 왜 웹 검색 대신 이걸 쓰나:
 * 우리 유입의 78%가 네이버다. 글감을 영어권 웹 검색으로 뽑으면 한국 검색 수요와 어긋난다.
 * 게다가 웹 검색엔 발행일이 안 붙어서, 이미 끝난 이벤트를 글감으로 내는 사고가 났다
 * (2026-07-12 이슈 #16 = 이미 끝난 MLB 올스타전). pubDate가 있으면 그건 기계가 거른다.
 *
 * 문서: https://api.ncloud-docs.com/docs/naver-api-hub-search-news
 * 한도: 하루 25,000건 (키워드 십여 개 × 1회 호출이라 남아돈다)
 */

const ENDPOINT = "https://naverapihub.apigw.ntruss.com/search/v1/news";

export type NaverNewsItem = {
  title: string;
  originallink: string;
  link: string;
  description: string;
  pubDate: string;
};

export type NewsArticle = {
  /** 어느 키워드로 걸렸는지 */
  keyword: string;
  title: string;
  /** 네이버 링크보다 원문을 우선한다 — 사라질 확률이 낮다 */
  url: string;
  summary: string;
  /** ISO 날짜 (KST 기준 YYYY-MM-DD) */
  date: string;
  publishedAt: number;
  /** 중계·편성 각도와 얼마나 붙는지 (정렬용) */
  score: number;
};

/**
 * 감시 키워드. 우리가 글로 쓸 수 있는 것만 둔다 —
 * 중계 편성으로 이어지지 않는 종목·리그를 넣으면 글감이 아니라 소음이 된다.
 */
export const WATCH_KEYWORDS = [
  "이정후",
  "손흥민",
  "이강인",
  "김민재",
  "오타니",
  "김하성",
  "쿠팡플레이 축구",
  "티빙 야구 중계",
  "EPL 개막",
  "KBO 후반기",
  "해외축구 중계권",
  "MLB 중계",
];

/**
 * "어디서 보나" 각도로 쓸 수 있는 기사인지 가늠하는 신호.
 * 이적·개막·복귀처럼 **중계처가 바뀌는 사건**에 가중치를 준다.
 */
const ANGLE_WEIGHTS: [RegExp, number][] = [
  [/중계권|독점 중계|생중계|중계 채널/, 3],
  [/이적|트레이드|계약|합의|영입/, 3],
  [/개막|일정 확정|데뷔|복귀|맞대결/, 2],
  [/쿠팡플레이|티빙|SPOTV|스포티비|디즈니\+|JTBC|치지직/, 3],
  [/무료|요금|구독|가입/, 2],
  [/한국어 해설|해설진/, 2],
];

/** 제목·요약에 섞여 오는 <b> 하이라이트 태그와 HTML 엔티티를 걷어낸다. */
export function cleanText(raw: string): string {
  return raw
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** pubDate(RFC 1123) → KST 날짜 문자열. 파싱 실패는 호출부에서 버린다. */
export function toKstDate(pubDate: string): string | null {
  const ms = Date.parse(pubDate);
  if (Number.isNaN(ms)) return null;
  return new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * 감점 신호 — 방송·미디어 **산업** 기사.
 * `중계권`·`티빙` 같은 단어를 그대로 갖고 있어서 가점만 두면 상위권을 통째로 차지한다.
 * 첫 실행에서 상위 15건 중 절반이 "중앙일보 도산", "KBS 적자", "JTBC 회생"이었다(2026-07-20).
 * 시청자가 검색할 일이 없는 기사다.
 */
const NOISE =
  /적자|흑자|실적|영업이익|주가|증권|매출|기업회생|도산|인수|합병|지분|채용|위촉|앰배서더|드라마|영화|예능|오디션|아이돌|시상식|주주|상장|투자유치|가입자|이용자|점유율|정보 ?유출|시청률|MAU/;

/** 스포츠 기사인지 가늠하는 신호. 하나도 없으면 우리 글감이 아니다. */
const SPORTS = /경기|선수|구단|감독|리그|시즌|출전|선발|이적|데뷔|복귀|개막|우승|승리|패배|홈런|골|타율|방어율|중계|해설|맞대결|원정|홈경기/;

export function scoreArticle(title: string, summary: string): number {
  const text = `${title} ${summary}`;
  if (!SPORTS.test(text)) return -1;
  if (NOISE.test(text)) return -1;

  let score = 0;
  for (const [pattern, weight] of ANGLE_WEIGHTS) {
    if (pattern.test(text)) score += weight;
  }
  return score;
}

/** 같은 기사가 여러 매체·여러 키워드로 중복돼 온다. 제목 기준으로 접는다. */
export function dedupe(articles: NewsArticle[]): NewsArticle[] {
  const seen = new Map<string, NewsArticle>();
  for (const a of articles) {
    const key = a.title.replace(/[^0-9a-z가-힣]/gi, "").slice(0, 40);
    const prev = seen.get(key);
    if (!prev || a.score > prev.score) seen.set(key, a);
  }
  return [...seen.values()];
}

export function toArticles(
  keyword: string,
  items: NaverNewsItem[],
  sinceMs: number,
): NewsArticle[] {
  const out: NewsArticle[] = [];
  for (const item of items) {
    const publishedAt = Date.parse(item.pubDate);
    if (Number.isNaN(publishedAt) || publishedAt < sinceMs) continue;

    const date = toKstDate(item.pubDate);
    if (!date) continue;

    const title = cleanText(item.title);
    const summary = cleanText(item.description);
    out.push({
      keyword,
      title,
      url: item.originallink || item.link,
      summary,
      date,
      publishedAt,
      score: scoreArticle(title, summary),
    });
  }
  return out;
}

export async function searchNews(
  keyword: string,
  opts: { display?: number; keyId: string; key: string },
): Promise<NaverNewsItem[]> {
  const params = new URLSearchParams({
    query: keyword,
    display: String(opts.display ?? 20),
    start: "1",
    sort: "date",
  });

  const res = await fetch(`${ENDPOINT}?${params}`, {
    headers: {
      "X-NCP-APIGW-API-KEY-ID": opts.keyId,
      "X-NCP-APIGW-API-KEY": opts.key,
    },
    // fetch-cache-ok: GitHub Actions(tsx)에서만 도는 수집 코드. Next 런타임 캐시와 무관.
  });

  if (!res.ok) {
    throw new Error(
      `네이버 뉴스 검색 실패 (${keyword}): ${res.status} ${await res.text()}`,
    );
  }

  const json = (await res.json()) as { items?: NaverNewsItem[] };
  return json.items ?? [];
}

/**
 * 각도 점수·최신순으로. 감점된 기사(산업 뉴스·비스포츠)는 아예 뺀다.
 *
 * `maxPerKeyword`를 주면 한 키워드가 목록을 독식하지 못하게 막는다.
 * 같은 사건을 매체별로 쓴 기사(예: 홈런더비 시청자 수 3건)가 상위권을 통째로 먹던 걸 막는 용도다.
 */
export function rankArticles(
  articles: NewsArticle[],
  limit: number,
  maxPerKeyword?: number,
): NewsArticle[] {
  const sorted = dedupe(articles)
    .filter((a) => a.score >= 0)
    .sort((a, b) => b.score - a.score || b.publishedAt - a.publishedAt);

  if (!maxPerKeyword) return sorted.slice(0, limit);

  const used = new Map<string, number>();
  const out: NewsArticle[] = [];
  for (const a of sorted) {
    const n = used.get(a.keyword) ?? 0;
    if (n >= maxPerKeyword) continue;
    used.set(a.keyword, n + 1);
    out.push(a);
    if (out.length >= limit) break;
  }
  return out;
}
