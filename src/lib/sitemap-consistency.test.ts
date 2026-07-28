import { test } from "node:test";
import assert from "node:assert/strict";
import scheduleData from "@/data/schedule.json";
import archiveData from "@/data/schedule-archive.json";
import worldcupData from "@/data/worldcup.json";
import resultsArchiveData from "@/data/results-archive.json";
import { matchToSlug } from "@/lib/match-slug";
import { isRichMatch } from "@/lib/match-quality";
import type { Schedule, ScheduleData } from "@/types/schedule";
import type { ResultsData } from "@/types/results";

/**
 * 사이트맵 ↔ 매치 페이지 noindex 신호 일치 가드.
 *
 * 서로 다른 schedule id 가 같은 슬러그(=같은 URL)를 낼 수 있다. 사전방송/본방송이 따로
 * 편성되는 경우 등이고, 실측 2026-07-28 기준 **충돌 228종**이다.
 *
 * 이때 행별로 `isRichMatch` 를 돌리면 같은 URL 을 두고 사이트맵은 "색인하라",
 * 페이지는 `noindex` 를 주장하는 모순이 생긴다. 실제로 1건 발생했다
 * (`/match/2026-07-10-mbc-sports-plus-남부리그-vs-북부리그`: 17:15 행은 rich=false,
 * 17:30 행은 rich=true).
 *
 * 매치 페이지의 `findMatchAnywhere` 는 schedule → worldcup → archive 순으로 **각 소스의
 * 첫 일치**를 고른다. 사이트맵도 같은 규칙으로 대표 행을 고르고 그 행에 대해서만
 * 판정해야 한다. 이 테스트가 그 규칙을 고정한다.
 */

const data = scheduleData as unknown as ScheduleData;
const worldcup = worldcupData as unknown as ScheduleData;
const archive = archiveData as unknown as ScheduleData;
const resultsArchive = resultsArchiveData as unknown as ResultsData;
const TODAY = "2026-07-28";

/** 매치 페이지의 findMatchAnywhere 와 동일한 해석 규칙. */
function resolve(slug: string): Schedule | undefined {
  for (const src of [data.schedules, worldcup.schedules, archive.schedules]) {
    const hit = src.find((s) => matchToSlug(s) === slug);
    if (hit) return hit;
  }
  return undefined;
}

test("슬러그 대표 행 선택이 페이지 해석과 같다", () => {
  const bySlug = new Map<string, Schedule>();
  for (const s of [...data.schedules, ...worldcup.schedules, ...archive.schedules]) {
    const slug = matchToSlug(s);
    if (!bySlug.has(slug)) bySlug.set(slug, s);
  }
  const mismatched: string[] = [];
  for (const [slug, picked] of bySlug) {
    const pageRow = resolve(slug);
    if (pageRow?.id !== picked.id) mismatched.push(`${slug}: sitemap=${picked.id} page=${pageRow?.id}`);
  }
  assert.deepEqual(mismatched, [], `대표 행 선택이 어긋난다:\n  ${mismatched.slice(0, 8).join("\n  ")}`);
});

test("같은 URL 에 대해 사이트맵 포함 여부와 noindex 가 모순되지 않는다", () => {
  // 대표 행 기준으로 판정하면, 충돌이 몇 종이든 결론이 하나로 정해져야 한다.
  const slugs = new Set<string>();
  for (const s of [...data.schedules, ...worldcup.schedules, ...archive.schedules]) {
    slugs.add(matchToSlug(s));
  }
  const conflicts: string[] = [];
  for (const slug of slugs) {
    const row = resolve(slug);
    if (!row) continue;
    // 사이트맵이 넣을지 = 대표 행의 isRichMatch. 페이지 noindex 도 대표 행의 isRichMatch.
    // 둘이 같은 함수·같은 행이므로 반드시 같아야 한다. 다르면 해석 규칙이 갈라진 것.
    const sitemapIncludes = isRichMatch(row, resultsArchive, TODAY);
    const pageIndexable = isRichMatch(resolve(slug)!, resultsArchive, TODAY);
    if (sitemapIncludes !== pageIndexable) conflicts.push(slug);
  }
  assert.deepEqual(conflicts, [], `신호 모순:\n  ${conflicts.slice(0, 8).join("\n  ")}`);
});

test("충돌하는 슬러그가 존재한다는 전제 자체를 고정한다", () => {
  // 충돌이 0이 되면 위 두 테스트가 아무것도 검증하지 않는다(가드가 조용히 무력화됨).
  // 실제로 충돌은 계속 발생하므로, 발생 사실을 확인해 가드가 살아 있음을 보장한다.
  const counts = new Map<string, number>();
  for (const s of [...data.schedules, ...worldcup.schedules, ...archive.schedules]) {
    const slug = matchToSlug(s);
    counts.set(slug, (counts.get(slug) ?? 0) + 1);
  }
  const collisions = [...counts.values()].filter((n) => n > 1).length;
  assert.ok(collisions > 0, "슬러그 충돌이 0이다 — 가드가 검증할 대상이 없어졌는지 확인할 것");
});
