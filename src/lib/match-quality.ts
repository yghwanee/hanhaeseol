import type { Schedule } from "@/types/schedule";
import type { ResultsData } from "@/types/results";
import { readInsight } from "@/lib/insights/storage";
import { findResult } from "@/lib/results/lookup";

/**
 * 매치 페이지가 "색인 가치가 있는" 풍부한 페이지인지 판정.
 *
 * AdSense·구글은 페이지 한 장의 글자 수가 아니라 사이트 전체 평균 품질을 본다.
 * 템플릿에 데이터만 채운 얇은 매치(예정 경기 + 인사이트 없음 + 스코어 없음)가
 * 수백 개 색인되면 사이트 전체가 "scaled / low value content"로 판정된다.
 * 그래서 얇은 매치는 sitemap에서 빼고 noindex 처리해 색인 평균을 끌어올린다.
 *
 * 판정 기준 (하나라도 만족하면 rich):
 *  - AI 인사이트(경기 미리보기)가 있음 → 고유 산문 콘텐츠 보유
 *  - 종료된 경기의 최종 스코어가 있음 → 고유 결과 데이터 보유
 *
 * NOTE: readInsight는 파일시스템을 읽으므로 서버(빌드/SSR)에서만 호출해야 한다.
 *       sitemap.ts와 match/[slug]/page.tsx 모두 서버 실행이라 안전.
 */
export function isRichMatch(match: Schedule, results: ResultsData | null): boolean {
  if (readInsight(match.id)) return true;
  const r = findResult(results, match);
  return !!r && typeof r.homeScore === "number" && typeof r.awayScore === "number";
}
