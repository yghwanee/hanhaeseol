/** EPL rankStatus 값별 색 라인 & 한글 라벨. null이면 표시 없음. */

export interface RankStatusStyle {
  /** 행 좌측 세로 라인 색 (tailwind class) */
  bar: string;
  /** 범례용 한글 라벨 */
  label: string;
}

const MAP: Record<string, RankStatusStyle> = {
  "UEFA Champions League": { bar: "bg-sky-500", label: "챔피언스리그 진출" },
  "UEFA Europa League": { bar: "bg-amber-500", label: "유로파리그 진출" },
  "UEFA Conference League": { bar: "bg-emerald-500", label: "컨퍼런스리그 진출" },
  Relegation: { bar: "bg-rose-500", label: "강등권" },
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
