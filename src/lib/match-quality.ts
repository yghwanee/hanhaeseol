import type { Schedule } from "@/types/schedule";
import type { ResultsData } from "@/types/results";
import { readInsight } from "@/lib/insights/storage";
import { findResult } from "@/lib/results/lookup";
import { getTodayString } from "@/lib/schedule-utils";

/**
 * 매치 페이지를 색인할지 판정.
 *
 * 원래 기준은 "인사이트가 있거나 최종 스코어가 있으면 색인"이었다. AdSense가 사이트 전체
 * 평균 품질을 본다는 판단으로 얇은 매치를 걷어내려던 것인데, 결과적으로 **경기가 끝난 뒤에야
 * 색인되는** 순서가 됐다.
 *
 * 2026-07-20 네이버 서치어드바이저에서 그게 뒤집혔다. 검색 수요는 경기 전과 당일에 몰린다.
 * `2026년 07월 16일 kia 타이거즈 ssg 랜더스` 한 쿼리가 147,103 노출을 냈고, 매치 페이지 하나가
 * 414,629 노출에 49 클릭을 만들고 있었다(같은 페이지가 구글에선 노출 0이었다).
 * 그런데 우리는 수요가 몰리는 바로 그 시점에 noindex를 걸어두고 있었다.
 *
 * 그래서 **아직 열리지 않은 경기도 색인 대상**으로 바꾼다. 편성 정보(시간·채널·한국어 해설
 * 여부)만으로도 "오늘 A vs B 어디서 보나"라는 질문의 답이 되고, 그게 이 사이트의 본질이다.
 * 실측으로도 그 페이지들은 1,090~2,159자로 얇지 않았다(kicktalk 팀 페이지가 1,171자).
 *
 * 계속 제외하는 것: **날짜가 지났는데 스코어가 없는 경기.** 결과 수집에 실패했거나 취소된
 * 경기라 정말로 빈 페이지다.
 *
 * 판정 기준 (하나라도 만족하면 색인):
 *  - AI 인사이트가 있음 → 고유 산문 보유
 *  - 최종 스코어가 있음 → 고유 결과 보유
 *  - 아직 열리지 않은 경기 → 편성 정보 자체가 검색 수요의 대상
 *
 * NOTE: readInsight는 파일시스템을 읽으므로 서버(빌드/SSR)에서만 호출해야 한다.
 *       sitemap.ts와 match/[slug]/page.tsx 모두 서버 실행이라 안전.
 */
export function isRichMatch(
  match: Schedule,
  results: ResultsData | null,
  todayISO: string = getTodayString(),
): boolean {
  if (readInsight(match.id)) return true;

  const r = findResult(results, match);
  if (r && typeof r.homeScore === "number" && typeof r.awayScore === "number") return true;

  // 오늘 포함 이후 경기는 편성 정보로 색인한다.
  return match.date >= todayISO;
}
