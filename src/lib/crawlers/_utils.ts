import type { Schedule } from "@/types/schedule";

export const CRAWLER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** 타임스탬프/ISO 문자열/Date를 KST 기준 {date: "YYYY-MM-DD", time: "HH:mm"} 으로 변환 */
export function toKstDateTime(input: number | string | Date): { date: string; time: string } {
  const d = input instanceof Date ? input : new Date(input);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${hour}:${get("minute")}`,
  };
}

/** 동시 실행 수를 제한한 병렬 실행 (Promise.all의 concurrency 제한 버전) */
export async function pLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * 팀명·리그명·id 앞뒤 공백 제거 — 크롤러 10종의 공통 마지막 관문(`crawlAll`).
 *
 * 🔴 이게 왜 필요한가: `resultKey` 는 `date|categoryId|home|away` 를 **정규화 없이**
 * 조합한다. 그래서 팀명 끝에 공백이 한 칸만 붙어도 스코어가 영영 안 붙는데,
 * 화면에는 편성이 정상으로 보여 아무도 눈치채지 못한다. 실제로 쿠팡플레이 API 가
 * `"찰턴 "`·`"파더보른 "` 을 그대로 내려주고 있었다(2026-08-27 발견).
 *
 * 크롤러마다 고치면 새 소스가 들어올 때 같은 일이 또 난다. 한 곳에서 막는다.
 * 슬러그는 `matchToSlug` 가 이미 `trim()` 하므로 URL 은 바뀌지 않는다.
 */
export function trimNames(s: Schedule): Schedule {
  return {
    ...s,
    id: s.id.trim(),
    homeTeam: s.homeTeam.trim(),
    awayTeam: s.awayTeam.trim(),
    league: s.league.trim(),
  };
}
