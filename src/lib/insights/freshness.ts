/**
 * AI 미리보기 신선도.
 *
 * 🔴 왜 (2026-10-22): 생성기가 6일 앞까지 한 번 만들고 다시 안 만들어서, 10/15 에 만든 글이
 * 10/21 KBO 포스트시즌 경기에 「가을야구 진출을 위한 중요한 시점」이라고 쓰고 있었다.
 * 그 사이 순위·대진·흐름이 다 바뀐다.
 *  - 생성기: 경기 2일 안으로 들어왔는데 글이 경기일보다 3일 넘게 앞서 만들어졌으면 다시 만든다.
 *  - 화면: 경기일보다 4일 넘게 앞서 만든 글은 안 띄운다(재생성이 무료 할당량에 밀린 경우).
 *    그 자리는 데이터로 만드는 자동 미리보기가 그대로 채운다.
 */
export const REGEN_WITHIN_DAYS = 2;
export const STALE_AFTER_DAYS = 3;
export const HIDE_AFTER_DAYS = 4;

/** UTC ISO → KST 날짜 */
function kstDate(iso: string): string {
  return new Date(Date.parse(iso) + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
}

/** 경기일 기준 며칠 앞서 만든 글인지 */
export function insightLeadDays(generatedAt: string, matchDate: string): number {
  return daysBetween(kstDate(generatedAt), matchDate);
}

export function shouldRegenerate(generatedAt: string, matchDate: string, today: string): boolean {
  return daysBetween(today, matchDate) <= REGEN_WITHIN_DAYS && insightLeadDays(generatedAt, matchDate) > STALE_AFTER_DAYS;
}

export function isInsightTooOld(generatedAt: string, matchDate: string): boolean {
  return insightLeadDays(generatedAt, matchDate) > HIDE_AFTER_DAYS;
}
