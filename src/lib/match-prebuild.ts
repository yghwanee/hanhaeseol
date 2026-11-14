import type { Schedule } from "@/types/schedule";
import { findMatchBySlug, matchToSlug } from "@/lib/match-slug";
import { isRetiredMatchDate } from "@/lib/match-retention";

/**
 * `/match/[slug]` 의 빌드 대상 슬러그 (2026-11-14, 이슈 #96).
 *
 * `lookup` 은 페이지가 슬러그를 해석하는 목록(`slugLookup`)을 **그대로** 받는다.
 * 같은 슬러그를 내는 행이 여럿이면 `findMatchBySlug` 가 첫 행을 고르므로, 그 슬러그는
 * 한 번만 내면 된다. 보존 기간 밖(미들웨어 410)은 굽지 않는다.
 *
 * 종전 목록(현재 편성 7일치)은 이 목록의 부분집합이다 — `test:match-prebuild` 가 확인한다.
 */
export function prebuildMatchParams(lookup: Schedule[]): { slug: string }[] {
  const seen = new Set<string>();
  const out: { slug: string }[] = [];
  for (const s of lookup) {
    if (isRetiredMatchDate(s.date)) continue;
    const slug = matchToSlug(s);
    if (seen.has(slug)) continue;
    seen.add(slug);
    // 해석 결과가 같은 날짜 범위 안이어야 페이지가 notFound 로 떨어지지 않는다
    // (page.tsx: `if (!match || isRetiredMatchDate(match.date)) notFound()`).
    const resolved = findMatchBySlug(lookup, slug);
    if (!resolved || isRetiredMatchDate(resolved.date)) continue;
    out.push({ slug });
  }
  return out;
}
