import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dedupeReversedFixtures } from "./fixture-dedupe";
import { matchToSlug } from "./match-slug";
import type { Schedule, ScheduleData } from "@/types/schedule";

function s(p: Partial<Schedule>): Schedule {
  return {
    id: "x",
    date: "2026-08-13",
    time: "03:30",
    sport: "축구",
    league: "클럽 친선경기",
    homeTeam: "맨유",
    awayTeam: "리즈",
    platform: "쿠팡플레이",
    koreanCommentary: true,
    ...p,
  } as Schedule;
}

test("홈/원정이 뒤집힌 같은 경기는 하나로 접힌다", () => {
  const out = dedupeReversedFixtures([
    s({ id: "b", homeTeam: "맨유", awayTeam: "리즈" }),
    s({ id: "a", homeTeam: "리즈", awayTeam: "맨유" }),
  ]);
  assert.equal(out.length, 1);
});

test("어느 쪽이 남는지는 id 사전순으로 고정된다(빌드마다 URL 이 바뀌면 안 된다)", () => {
  const forward = dedupeReversedFixtures([
    s({ id: "b", homeTeam: "맨유", awayTeam: "리즈" }),
    s({ id: "a", homeTeam: "리즈", awayTeam: "맨유" }),
  ]);
  const reversed = dedupeReversedFixtures([
    s({ id: "a", homeTeam: "리즈", awayTeam: "맨유" }),
    s({ id: "b", homeTeam: "맨유", awayTeam: "리즈" }),
  ]);
  assert.equal(forward[0].id, "a");
  assert.equal(reversed[0].id, "a", "입력 순서가 달라도 같은 행이 남아야 한다");
});

test("팀 순서가 같은 중복은 건드리지 않는다", () => {
  // SPOTV NOW 는 한 경기를 한국어·현지 두 편성으로 내보낸다(koreanCommentary 만 다름).
  // 슬러그가 같아 사이트맵 dedupe 가 처리하므로 여기서 지우면 화면 정보가 준다.
  const out = dedupeReversedFixtures([
    s({ id: "a", koreanCommentary: true }),
    s({ id: "b", koreanCommentary: false }),
  ]);
  assert.equal(out.length, 2);
});

test("시각·플랫폼이 다르면 서로 다른 경기로 둔다", () => {
  const diffTime = dedupeReversedFixtures([
    s({ id: "a", time: "03:30" }),
    s({ id: "b", time: "18:30", homeTeam: "리즈", awayTeam: "맨유" }),
  ]);
  assert.equal(diffTime.length, 2);

  const diffPlatform = dedupeReversedFixtures([
    s({ id: "a", platform: "쿠팡플레이" }),
    s({ id: "b", platform: "SPOTV", homeTeam: "리즈", awayTeam: "맨유" }),
  ]);
  assert.equal(diffPlatform.length, 2);
});

test("중복이 없으면 순서와 개수를 그대로 둔다", () => {
  const input = [
    s({ id: "a", homeTeam: "A", awayTeam: "B" }),
    s({ id: "b", homeTeam: "C", awayTeam: "D" }),
    s({ id: "c", homeTeam: "E", awayTeam: "F" }),
  ];
  assert.deepEqual(dedupeReversedFixtures(input).map((x) => x.id), ["a", "b", "c"]);
});

/**
 * 실데이터 회귀 — 아카이브에 반전 중복이 남아 있으면 같은 경기가 두 URL 로 사이트맵에
 * 올라간다(2026-08-13 실측 2건: `리즈 vs 맨유`↔`맨유 vs 리즈`,
 * `아이슬란드 vs 아르헨티나`↔반대). 슬러그가 서로 달라 `dedupeSitemapEntries` 는 못 잡는다.
 */
test("실데이터에 반전 중복 슬러그가 남지 않는다", () => {
  const read = (p: string) =>
    (JSON.parse(readFileSync(join(process.cwd(), p), "utf8")) as ScheduleData).schedules ?? [];

  const all = [
    ...read("src/data/schedule.json"),
    ...read("src/data/worldcup.json"),
    ...read("public/schedule-archive.json"),
  ];
  assert.ok(all.length > 500, `편성 데이터를 못 읽음(${all.length}) — 가드 자체가 깨진 것`);

  const deduped = dedupeReversedFixtures(all);
  const slugs = new Set(deduped.map(matchToSlug));

  const offenders: string[] = [];
  for (const m of deduped) {
    const reversedSlug = matchToSlug({ ...m, homeTeam: m.awayTeam, awayTeam: m.homeTeam });
    if (slugs.has(reversedSlug)) offenders.push(`${m.date} ${m.homeTeam} vs ${m.awayTeam}`);
  }
  assert.deepEqual(offenders, [], `같은 경기가 두 슬러그로 남아 있다:\n${offenders.join("\n")}`);
});
