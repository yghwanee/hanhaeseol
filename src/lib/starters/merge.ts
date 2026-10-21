import type { MatchStarters } from "@/types/starter";
import { MATCH_RETENTION_DAYS } from "@/lib/match-retention";

/**
 * 이번 크롤 결과를 이전 starters.json 위에 얹는다.
 *
 * 🔴 왜 (2026-10-22 실측): 크롤이 "오늘부터 7일"만 받아 파일을 통째로 덮어써서, 날짜가
 * 넘어가면 어제 경기 선발이 사라졌다. 10/20 LG-KIA 매치 페이지는 타순표에 선발
 * 카라스코·시라카와가 나오는데 바로 아래 「선발 매치업」이 "선발 미발표" 였다.
 *
 * - 이번에 받은 키는 새 값으로 바꾼다(선발 교체 반영).
 * - 이번에 못 받은 키는 이전 값을 지킨다. 경기가 시작되면 preview 가 선발을 안 줄 때가 있다.
 * - 매치 페이지 보존 기간(410)보다 오래된 키는 버린다 — 보여 줄 페이지가 없다.
 */
export function mergeStarters(
  prev: Record<string, MatchStarters>,
  next: Record<string, MatchStarters>,
  today: string,
): Record<string, MatchStarters> {
  const [y, m, d] = today.split("-").map(Number);
  const cutoff = new Date(Date.UTC(y, m - 1, d - MATCH_RETENTION_DAYS)).toISOString().slice(0, 10);
  const out: Record<string, MatchStarters> = {};
  for (const [k, v] of Object.entries(prev)) {
    if (k.slice(0, 10) >= cutoff) out[k] = v;
  }
  for (const [k, v] of Object.entries(next)) {
    out[k] = { ...v, teams: { ...(out[k]?.teams ?? {}), ...v.teams } };
  }
  return out;
}
