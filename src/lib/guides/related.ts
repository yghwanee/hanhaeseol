/**
 * 허브(리그·플랫폼·팀) 페이지 → 관련 Topic 글 링크 고르기.
 *
 * 🔴 왜 (2026-10-19 GSC 실측): 토픽 글 73편 중 63편이 「발견됨 - 현재 색인이 생성되지 않음」,
 * 최종 크롤 「해당사항 없음」 — 구글이 한 번도 안 가져갔다. URL 검사의 「참조 페이지」도
 * 「감지된 페이지 없음」이었다. 구글이 자주 다시 오는 페이지는 홈·플랫폼·리그(색인 50개의
 * 대부분)인데, 거기서 `/guide/*` 로 나가는 링크가 0개였다. 사이트맵만으로는 안 가져간다.
 *
 * 매칭은 **제목 + keywords** 만 본다. 본문까지 보면 `SPOTV`·`쿠팡플레이` 같은 이름이
 * 글마다 끝 문단에 한 번씩 나와 거의 모든 글이 걸린다.
 */
import { getAllGuideMetas, type GuideMeta } from "./index";

export function relatedGuides(terms: string[], limit = 3): GuideMeta[] {
  const needles = terms
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length >= 2);
  if (needles.length === 0) return [];
  return getAllGuideMetas()
    .filter((g) => {
      const hay = `${g.title} ${(g.keywords ?? []).join(" ")}`.toLowerCase();
      return needles.some((n) => hay.includes(n));
    })
    .slice(0, limit);
}
