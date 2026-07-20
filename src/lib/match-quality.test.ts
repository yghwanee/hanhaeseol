import { test } from "node:test";
import assert from "node:assert/strict";
import { isRichMatch } from "./match-quality";
import type { Schedule } from "@/types/schedule";
import type { ResultsData } from "@/types/results";
import { resultKey } from "@/lib/results/lookup";
import { categoriesForLeague } from "@/lib/results/lookup";

function sched(over: Partial<Schedule>): Schedule {
  return {
    id: `id-${Math.random()}`,
    date: "2026-07-20",
    time: "18:30",
    sport: "야구",
    league: "KBO",
    homeTeam: "삼성",
    awayTeam: "두산",
    platform: "티빙",
    koreanCommentary: true,
    ...over,
  } as Schedule;
}

/** findResult 는 byKey 를 본다. 테스트도 같은 키로 넣어야 실제 경로를 검증한다. */
function results(
  rows: { date: string; homeTeam: string; awayTeam: string; homeScore?: number; awayScore?: number }[],
  league = "KBO",
): ResultsData {
  const byKey: Record<string, unknown> = {};
  const categoryId = categoriesForLeague(league)[0];
  for (const r of rows) {
    byKey[resultKey(r.date, categoryId, r.homeTeam, r.awayTeam)] = r;
  }
  return { lastUpdated: "", byKey, results: rows } as unknown as ResultsData;
}

const TODAY = "2026-07-20";

test("스코어가 있으면 색인한다", () => {
  const m = sched({ date: "2026-07-10" });
  const r = results([
    { date: "2026-07-10", homeTeam: "삼성", awayTeam: "두산", homeScore: 5, awayScore: 3 },
  ]);
  assert.equal(isRichMatch(m, r, TODAY), true);
});

test("아직 열리지 않은 경기는 스코어가 없어도 색인한다", () => {
  // 검색 수요가 몰리는 시점이 바로 여기다(2026-07-20 네이버 데이터).
  assert.equal(isRichMatch(sched({ date: "2026-07-21" }), null, TODAY), true);
  // 오늘 경기도 포함
  assert.equal(isRichMatch(sched({ date: TODAY }), null, TODAY), true);
});

test("지난 경기인데 스코어가 없으면 제외한다", () => {
  // 결과 수집 실패나 취소 경기. 정말로 빈 페이지다.
  assert.equal(isRichMatch(sched({ date: "2026-07-19" }), null, TODAY), false);
  assert.equal(
    isRichMatch(
      sched({ date: "2026-07-19" }),
      results([{ date: "2026-07-19", homeTeam: "삼성", awayTeam: "두산" }]),
      TODAY,
    ),
    false,
  );
});
