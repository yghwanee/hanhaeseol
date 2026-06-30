// 유튜브 하이라이트 영상 검색 (YouTube Data API v3, search.list).
// 크롤 시 "종료된 축구 경기"에 대해 1회 호출 → videoId를 결과에 저장(아카이브에 영구 보관).
// YOUTUBE_API_KEY 미설정 시 항상 null → UI에서 하이라이트 섹션을 숨김(조용히 비활성).

const API = "https://www.googleapis.com/youtube/v3/search";

// 한국어 스포츠 하이라이트를 주로 올리는 공식/대형 채널 ID(있으면 우선 선택).
// 운영하며 보강. 비어 있어도 동작(제목 필터 → 첫 결과 순으로 폴백).
const PREFERRED_CHANNELS = new Set<string>([
  // 예: "UCpcTrCXblq78GZrTUTLWeBw" (FIFA) 등 — 정확한 channelId 확인 후 채움
]);

interface YtSearchItem {
  id?: { videoId?: string };
  snippet?: { channelId?: string; title?: string; channelTitle?: string };
}

/**
 * "{home} {away} 하이라이트"로 유튜브 검색해 가장 적합한 임베드 가능 영상 ID를 반환.
 * 선택 우선순위: ①선호 채널 → ②제목에 '하이라이트/highlight' 포함 → ③첫 결과.
 * 실패/키없음/결과없음 → null.
 */
export async function searchHighlightVideoId(
  home: string,
  away: string,
): Promise<string | null> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return null;

  const params = new URLSearchParams({
    key,
    part: "snippet",
    q: `${home} ${away} 하이라이트`,
    type: "video",
    videoEmbeddable: "true",
    maxResults: "5",
    order: "relevance",
    regionCode: "KR",
    relevanceLanguage: "ko",
  });

  let items: YtSearchItem[] = [];
  try {
    const res = await fetch(`${API}?${params.toString()}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { items?: YtSearchItem[] };
    items = json.items ?? [];
  } catch {
    return null;
  }

  const withId = items.filter((it) => it.id?.videoId);
  if (withId.length === 0) return null;

  const preferred = withId.find(
    (it) => it.snippet?.channelId && PREFERRED_CHANNELS.has(it.snippet.channelId),
  );
  if (preferred?.id?.videoId) return preferred.id.videoId;

  const titled = withId.find((it) => /하이라이트|highlight/i.test(it.snippet?.title ?? ""));
  if (titled?.id?.videoId) return titled.id.videoId;

  return withId[0]?.id?.videoId ?? null;
}
