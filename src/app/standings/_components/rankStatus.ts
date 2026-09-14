/** EPL rankStatus 값별 색 라인 & 한글 라벨. null이면 표시 없음. */

export interface RankStatusStyle {
  /** 행 좌측 세로 라인 색 (tailwind class) */
  bar: string;
  /** 범례용 한글 라벨 */
  label: string;
}

/**
 * 🔴 네 상태를 네 가지 색으로 칠하지 않는다(키 컬러 정책: 배경 + 파랑 + 빨강).
 *
 * 유럽대항전 셋은 **순서가 있는 등급**이라 색상(hue)이 아니라 **명도**로 나눈다 —
 * 챔스가 가장 밝고 컨퍼런스가 가장 어둡다. 강등권만 빨강이다. 이렇게 하면
 * 색맹 사용자에게도 순서가 유지되고, 화면에 색이 늘어나지 않는다.
 */
const MAP: Record<string, RankStatusStyle> = {
  "UEFA Champions League": { bar: "bg-[oklch(0.78_0.14_250)]", label: "챔피언스리그 진출" },
  "UEFA Europa League": { bar: "bg-[oklch(0.62_0.16_255)]", label: "유로파리그 진출" },
  "UEFA Conference League": { bar: "bg-[oklch(0.46_0.10_258)]", label: "컨퍼런스리그 진출" },
  Relegation: { bar: "bg-[oklch(0.63_0.20_27)]", label: "강등권" },
};

export function rankStatusStyle(s: string | null | undefined): RankStatusStyle | null {
  if (!s) return null;
  return MAP[s] ?? null;
}

/** 페이지 하단 범례에 표시할 고유 그룹 목록(존재하는 status만) */
export function uniqueRankStatuses(values: (string | null | undefined)[]): RankStatusStyle[] {
  const seen = new Map<string, RankStatusStyle>();
  for (const v of values) {
    if (!v) continue;
    const st = MAP[v];
    if (st && !seen.has(v)) seen.set(v, st);
  }
  return [...seen.values()];
}
