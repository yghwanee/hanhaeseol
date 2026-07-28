/**
 * SERP 표시용 메타 텍스트 다듬기 + 질문형 구조화 데이터(FAQ) 생성.
 *
 * 두 가지 실측 문제에서 나왔다(2026-07-28).
 *
 * 1) description 길이 — 매치 페이지 description이 187~200자로 나가고 있었다. 구글은 약 155자,
 *    네이버는 더 짧게 자른다. 잘린 문장은 "…" 없이 끊겨서 SERP에서 미완성 문장으로 보인다.
 *    CTR이 유일한 레버인 상황(네이버 노출 366만 / CTR 0.1%)에서 그대로 둘 이유가 없다.
 *
 * 2) 질문형 마크업 — `FAQPage`가 홈·리그·플랫폼에만 있었고, 사이트의 91%인 매치 페이지와
 *    팀 페이지에는 없었다. 정작 그 페이지들이 노리는 쿼리가 "어디서 보나"라는 질문이다.
 *
 *    ⚠️ **구글 FAQ 리치결과는 2026-05-07 전 사이트 대상으로 폐지됐다.** 따라서 구글 SERP
 *    확장은 기대하지 않는다. 남는 이득은 ①AI 답변 엔진이 Q&A 마크업을 인용 단위로 쓰는 것
 *    ②화면에 실제로 답이 보이는 것. 이 둘 때문에 유지하되, 구글 리치결과를 근거로 확대하지 않는다.
 */

/** 구글이 대체로 보여주는 상한. 넘으면 잘리므로 여기서 미리 자른다. */
export const DESCRIPTION_MAX = 155;

/**
 * description을 SERP 상한에 맞춰 자른다. 문장(`.`)·절(`,`)·띄어쓰기 경계를 우선 찾아
 * 단어 중간에서 끊기지 않게 하고, 자른 경우에만 `…`를 붙인다.
 */
export function clampDescription(text: string, max: number = DESCRIPTION_MAX): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;

  // …를 붙일 자리를 남긴다.
  const room = max - 1;
  const head = t.slice(0, room);

  // 문장 끝이 상한 안에 있으면 거기서 깔끔하게 끝낸다(…도 필요 없다).
  const sentence = Math.max(head.lastIndexOf(". "), head.lastIndexOf("다. "));
  if (sentence >= max * 0.6) return t.slice(0, sentence + 1).trim();

  const boundary = Math.max(head.lastIndexOf(" "), head.lastIndexOf(", "));
  const cut = boundary >= max * 0.6 ? boundary : room;
  return `${t.slice(0, cut).replace(/[,\s]+$/, "")}…`;
}

export type SitemapEntry = {
  url: string;
  lastModified?: Date;
  changeFrequency?: string;
  priority?: number;
};

/**
 * 사이트맵 URL 중복 제거.
 *
 * 매치 URL은 `matchToSlug()`로 만드는데, **서로 다른 schedule id가 같은 슬러그를 낼 수 있다**
 * (같은 날·같은 채널·같은 두 팀의 사전방송/본방송이 따로 편성되는 경우 등). 그래서 사이트맵에
 * 같은 URL이 두 번 들어가고 있었다 — 실측 2026-07-28: 1,730개 항목 중 53개가 중복이었다.
 *
 * 매치 페이지는 슬러그 하나를 경기 하나로 해석하므로 중복 항목은 같은 페이지를 가리키며,
 * lastmod·priority만 서로 다르게 주장하는 모순 신호가 된다. priority가 높은 쪽,
 * 같으면 lastModified가 최신인 쪽을 남긴다.
 */
export function dedupeSitemapEntries<T extends SitemapEntry>(entries: T[]): T[] {
  const best = new Map<string, T>();
  for (const e of entries) {
    const prev = best.get(e.url);
    if (!prev) {
      best.set(e.url, e);
      continue;
    }
    const pPrio = prev.priority ?? 0;
    const ePrio = e.priority ?? 0;
    if (ePrio > pPrio) {
      best.set(e.url, e);
      continue;
    }
    if (ePrio === pPrio && (e.lastModified?.getTime() ?? 0) > (prev.lastModified?.getTime() ?? 0)) {
      best.set(e.url, e);
    }
  }
  return [...best.values()];
}

export type Faq = { q: string; a: string };

/** 빈 답변은 구조화 데이터에서 빼야 한다(Google이 불완전 FAQ를 무시한다). */
export function compactFaqs(faqs: (Faq | null | undefined)[]): Faq[] {
  return faqs.filter((f): f is Faq => !!f && !!f.q.trim() && !!f.a.trim());
}

/**
 * 매치 페이지 FAQ. "어디서 보나 / 한국어 해설인가 / 몇 시인가" 세 질문이
 * 이 사이트로 들어오는 검색 의도의 사실상 전부다.
 */
export function buildMatchFaqs(input: {
  homeTeam: string;
  awayTeam: string;
  league: string;
  platform: string;
  dateLabel: string;
  time: string;
  commentaryLabel: string;
  /** Schedule.koreanCommentary 는 `"unknown"` 을 쓴다. 그 값은 "확인중"으로 답한다. */
  koreanCommentary?: boolean | "unknown" | null;
}): Faq[] {
  const vs = `${input.homeTeam} vs ${input.awayTeam}`;
  const korean =
    input.koreanCommentary === true
      ? `네, ${input.platform} 중계는 한국어 해설로 제공됩니다.`
      : input.koreanCommentary === false
        ? `아니요, ${input.platform} 중계는 현지 해설로 제공됩니다. 한국어 해설 편성은 확인되지 않았습니다.`
        : `${input.platform} 중계의 해설 언어가 아직 확인되지 않았습니다. 편성이 확정되면 갱신됩니다.`;

  return compactFaqs([
    {
      q: `${vs} 경기는 어디서 볼 수 있나요?`,
      a: `${input.dateLabel} ${input.time}에 시작하는 ${input.league} ${vs} 경기는 ${input.platform}에서 중계됩니다.`,
    },
    { q: `${vs} 중계는 한국어 해설인가요?`, a: korean },
    {
      q: `${vs} 경기는 몇 시에 시작하나요?`,
      a: `한국 시간 기준 ${input.dateLabel} ${input.time}에 시작합니다.`,
    },
  ]);
}

/** 팀 페이지 FAQ. 정식명을 질문에 넣어 "두산 베어스 중계 어디서" 쿼리에 맞춘다. */
export function buildTeamFaqs(input: {
  fullName: string;
  leagueName: string;
  platforms: string[];
  koreanRatio?: { korean: number; total: number };
  next?: { dateLabel: string; time: string; opponent: string; platforms: string[] } | null;
}): Faq[] {
  const where =
    input.platforms.length > 0
      ? `최근 편성 기준으로 ${input.fullName} 경기는 ${input.platforms.slice(0, 3).join(", ")}에서 중계됩니다.`
      : `${input.fullName} 경기의 국내 중계 편성이 아직 확인되지 않았습니다.`;

  const r = input.koreanRatio;
  const korean = !r
    ? ""
    : r.total === 0
      ? `${input.fullName} 경기의 해설 언어는 아직 확인되지 않았습니다.`
      : r.korean === r.total
        ? `수집된 ${r.total}경기 모두 한국어 해설로 제공됩니다.`
        : r.korean === 0
          ? `수집된 ${r.total}경기는 모두 현지 해설입니다.`
          : `수집된 ${r.total}경기 중 ${r.korean}경기가 한국어 해설입니다.`;

  return compactFaqs([
    { q: `${input.fullName} 경기는 어디서 볼 수 있나요?`, a: where },
    { q: `${input.fullName} 경기는 한국어 해설로 중계되나요?`, a: korean },
    input.next
      ? {
          q: `${input.fullName} 다음 경기는 언제인가요?`,
          a: `${input.next.dateLabel} ${input.next.time} ${input.next.opponent}전이며, ${input.next.platforms.slice(0, 2).join(", ") || "편성 확인 필요"}에서 중계 예정입니다.`,
        }
      : null,
  ]);
}
