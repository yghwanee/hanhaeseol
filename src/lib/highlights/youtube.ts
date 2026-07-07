// 유튜브 하이라이트 영상 검색 (YouTube Data API v3, search.list).
// 크롤 시 종료 경기에 대해 검색 → videoId를 결과에 저장(아카이브에 영구 보관).
// YOUTUBE_API_KEY 미설정 시 항상 null → UI에서 하이라이트 섹션을 숨김(조용히 비활성).

const API = "https://www.googleapis.com/youtube/v3/search";

/**
 * 리그(categoryId) → 공식 하이라이트 채널 고정 매핑.
 * 매핑된 리그는 해당 채널 안에서만 검색한다(channelId 파라미터).
 * 공식 채널에 아직 업로드 전이면 null → 매시 크롤이 재시도하다 올라오는 순간 잡는다.
 * (업로드는 보통 경기 종료 후 수십 분~수 시간 지연 — 이 지연 때문에 "아무 첫 결과"
 * 폴백을 두면 팬 클립이 영구 저장되므로, 매핑 리그는 폴백 없이 기다리는 게 정답.)
 */
const CHANNEL_BY_CATEGORY: Record<string, string> = {
  kbo: "UC8JtQf77wqhVpOQ8Cze8JjA", // TVING SPORTS
  worldcup: "UCTdZyOFVzontd9MZOJDg8Qw", // JTBC Sports
  mlb: "UCtm_QoN2SIxwCE-59shX7Qg", // SPOTV
};

/** enrich 대상 리그: 매핑 채널이 있는 리그 + 아래 GENERIC 허용 축구 리그. */
export function highlightChannelFor(categoryId: string): string | undefined {
  return CHANNEL_BY_CATEGORY[categoryId];
}

export interface YtSearchItem {
  id?: { videoId?: string };
  snippet?: { channelId?: string; title?: string; channelTitle?: string };
}

const HIGHLIGHT_TITLE = /하이라이트|highlight|h\/l/i;

/** 제목에 팀명이 언급되는지(2글자 이상 토큰 기준). "뉴욕 양키스" → "양키스"도 매칭. */
export function titleMentionsTeam(title: string, team: string): boolean {
  return team
    .split(/\s+/)
    .filter((t) => t.length >= 2)
    .some((t) => title.includes(t));
}

/** 공식 채널 스코프 결과에서 채택할 영상 선별: 하이라이트 제목 + 두 팀 모두 언급.
 *  한쪽만 요구하면 같은 팀의 다른 종목/다른 경기 영상이 통과한다
 *  (실측: "브라질 vs 노르웨이" 월드컵에 2019 핸드볼 "대한민국 VS 브라질"이 잡혔음). */
export function pickChannelScoped(
  items: YtSearchItem[],
  home: string,
  away: string,
): string | null {
  const hit = items.find(
    (it) =>
      it.id?.videoId &&
      HIGHLIGHT_TITLE.test(it.snippet?.title ?? "") &&
      titleMentionsTeam(it.snippet?.title ?? "", home) &&
      titleMentionsTeam(it.snippet?.title ?? "", away),
  );
  return hit?.id?.videoId ?? null;
}

/** 전체 검색(비매핑 리그) 결과에서 채택할 영상 선별: 하이라이트 제목만 요구. */
export function pickGeneric(items: YtSearchItem[]): string | null {
  const titled = items.find(
    (it) => it.id?.videoId && HIGHLIGHT_TITLE.test(it.snippet?.title ?? ""),
  );
  return titled?.id?.videoId ?? null;
}

async function ytSearch(params: URLSearchParams): Promise<YtSearchItem[]> {
  try {
    const res = await fetch(`${API}?${params.toString()}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { items?: YtSearchItem[] };
    return (json.items ?? []).filter((it) => it.id?.videoId);
  } catch {
    return [];
  }
}

/**
 * "{home} {away} 하이라이트" 유튜브 검색 → 적합한 임베드 가능 영상 ID 또는 null.
 *
 * - 매핑 리그(KBO/월드컵/MLB): 공식 채널 안에서만 검색. 제목이 하이라이트 형식이고
 *   두 팀 중 하나라도 언급해야 채택. 없으면 null(다음 크롤에서 재시도).
 * - 그 외(기타 축구): 전체 검색 후 제목에 '하이라이트/highlight' 포함된 것만 채택.
 *   (과거의 "첫 결과" 폴백은 오매칭 영구 저장 위험이라 제거.)
 */
export async function searchHighlightVideoId(
  home: string,
  away: string,
  categoryId?: string,
  matchDate?: string,
): Promise<string | null> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;

  const base: Record<string, string> = {
    key,
    part: "snippet",
    q: `${home} ${away} 하이라이트`,
    type: "video",
    videoEmbeddable: "true",
    maxResults: "5",
    order: "relevance",
    regionCode: "KR",
    relevanceLanguage: "ko",
  };
  // 경기일 이전 업로드 배제 — 같은 대진의 과거 경기/타 종목 옛 영상이 잡히는 것 방지
  // (실측: 7/7 경기에 4월/6월 SPOTV 하이라이트가 붙었음). MLB는 KST 경기일이
  // 미국 현지 전날이라 -1일 버퍼.
  if (matchDate && /^\d{4}-\d{2}-\d{2}$/.test(matchDate)) {
    const after = new Date(`${matchDate}T00:00:00+09:00`);
    after.setDate(after.getDate() - 1);
    base.publishedAfter = after.toISOString();
  }

  const channelId = categoryId ? CHANNEL_BY_CATEGORY[categoryId] : undefined;

  if (channelId) {
    const items = await ytSearch(new URLSearchParams({ ...base, channelId }));
    return pickChannelScoped(items, home, away);
  }

  const items = await ytSearch(new URLSearchParams(base));
  return pickGeneric(items);
}
