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
  // 월드컵 토너먼트 진출 미확정 경기는 "미정 vs 미정"이라 같은 날 여러 경기가
  // 동일 슬러그로 충돌한다. home===away인 경우에만 시간을 덧붙여 분리한다.
  // (실제 매치업은 home≠away라 기존 슬러그/SEO URL에 영향 없음.)
  const suffix = s.homeTeam === s.awayTeam ? `-${sanitize(s.time)}` : "";
  // NFC 정규화: Linux Vercel 빌드에서 한글 dynamic segment가 NFD/percent-encoded로
  // 변형되어 들어와 generateStaticParams의 slug와 page params가 어긋나는 사고를 막는다.
  return `${s.date}-${platformSlug}-${home}-vs-${away}${suffix}`.normalize("NFC");
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
  let target: string;
  try {
    target = decodeURIComponent(slug).normalize("NFC");
  } catch {
    target = slug.normalize("NFC");
  }
  return schedules.find((s) => matchToSlug(s) === target);
}
