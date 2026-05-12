import type { Schedule } from "@/types/schedule";
import { findPlatformSlugByName } from "@/lib/slugs";

/**
 * 매치 슬러그 생성: 안정적이고 SEO 친화적 (날짜 + 플랫폼 + 팀명).
 * 예) "2026-05-12-spotv-now-나폴리-vs-볼로냐"
 *
 * - 동일 날짜/플랫폼/매치업이면 동일 슬러그 → 멱등
 * - URL에 한글 그대로 유지 → 네이버 검색 결과에서 의미 노출
 * - 공백 / 슬래시 / 특수문자만 하이픈으로 정리
 */
export function matchToSlug(s: Schedule): string {
  const platformSlug =
    findPlatformSlugByName(s.platform) ?? sanitize(s.platform);
  const home = sanitize(s.homeTeam);
  const away = sanitize(s.awayTeam);
  return `${s.date}-${platformSlug}-${home}-vs-${away}`;
}

function sanitize(input: string): string {
  return input
    .trim()
    .replace(/[\s/\\?#%]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function findMatchBySlug(
  schedules: Schedule[],
  slug: string,
): Schedule | undefined {
  return schedules.find((s) => matchToSlug(s) === slug);
}
