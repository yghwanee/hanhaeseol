import { test } from "node:test";
import assert from "node:assert/strict";
import standingsData from "@/data/standings.json";
import {
  FULL_NAME_BY_LEAGUE,
  fullTeamName,
  hasFullName,
  teamNameVariants,
} from "./team-full-names";
import { buildTeamIndex } from "./teams";
import type { StandingsData } from "./teams";

test("매핑이 없는 팀은 축약명을 그대로 쓴다", () => {
  assert.equal(fullTeamName("mls", "밴쿠버 화이트캡스"), "밴쿠버 화이트캡스");
  assert.equal(fullTeamName("kbo", "존재하지않는팀"), "존재하지않는팀");
  assert.equal(fullTeamName("없는리그", "두산"), "두산");
  assert.equal(hasFullName("mls", "밴쿠버 화이트캡스"), false);
});

test("매핑된 팀은 정식명을 돌려준다", () => {
  assert.equal(fullTeamName("kbo", "두산"), "두산 베어스");
  assert.equal(fullTeamName("mlb", "시카고W"), "시카고 화이트삭스");
  assert.equal(fullTeamName("k-league-1", "서울"), "FC서울");
  assert.equal(hasFullName("kbo", "두산"), true);
});

test("변형 목록은 정식명이 먼저, 중복은 제거된다", () => {
  assert.deepEqual(teamNameVariants("kbo", "두산"), ["두산 베어스", "두산"]);
  // 매핑 없는 팀은 표기가 하나뿐이라 중복이 생기지 않아야 한다.
  assert.deepEqual(teamNameVariants("mlb", "애슬레틱스"), ["애슬레틱스"]);
});

/**
 * 이게 이 파일의 핵심 가드다. 매핑 키를 순위표 실제 표기와 한 글자라도 다르게 쓰면
 * 매핑이 조용히 적용되지 않고(fallback으로 축약명이 나감) 아무 에러도 안 난다.
 * 네이버가 표기를 바꾸는 경우도 여기서 잡힌다.
 */
test("모든 매핑 키가 순위표 실제 표기와 일치한다", () => {
  const index = buildTeamIndex(standingsData as unknown as StandingsData);
  const actualByLeague = new Map<string, Set<string>>();
  for (const t of index) {
    if (!actualByLeague.has(t.leagueSlug)) actualByLeague.set(t.leagueSlug, new Set());
    actualByLeague.get(t.leagueSlug)!.add(t.name);
  }

  const orphans: string[] = [];
  for (const [leagueSlug, map] of Object.entries(FULL_NAME_BY_LEAGUE)) {
    const actual = actualByLeague.get(leagueSlug);
    // 개막 전 리그는 팀 인덱스가 비어 있다(경기 0). 그때는 검증할 대상이 없다.
    if (!actual || actual.size === 0) continue;
    for (const shortName of Object.keys(map)) {
      if (!actual.has(shortName)) orphans.push(`${leagueSlug}: "${shortName}"`);
    }
  }

  assert.deepEqual(
    orphans,
    [],
    `순위표에 없는 표기를 매핑하고 있다(오타이거나 네이버가 표기를 바꿈):\n  ${orphans.join("\n  ")}`,
  );
});

/**
 * 정식명 표기가 편성 데이터(schedule.json)와 어긋나면 같은 팀이 사이트 안에서 두 이름으로
 * 존재하게 된다 — 팀 페이지는 `보스턴 레드소스`, 경기 카드는 `보스턴 레드삭스`. 검색 엔진
 * 입장에서는 엔티티가 갈라지고, 사용자는 다른 팀인 줄 안다.
 *
 * 실제로 첫 작성 때 이 실수를 했다(화이트삭스→화이트소스, 레드삭스→레드소스). 편성 데이터가
 * 이미 정식명을 쓰는 리그에서는 그 표기를 그대로 따라야 한다.
 */
test("정식명이 편성 데이터 표기와 일치한다", async () => {
  const { default: schedule } = await import("@/data/schedule.json");
  const { default: archive } = await import("@/data/schedule-archive.json");

  const scheduleNames = new Set<string>();
  for (const src of [schedule, archive] as { schedules?: { homeTeam: string; awayTeam: string; league: string }[] }[]) {
    for (const s of src.schedules ?? []) {
      scheduleNames.add(s.homeTeam);
      scheduleNames.add(s.awayTeam);
    }
  }

  // 편성 데이터가 축약이 아니라 정식명을 쓰는 리그만 검사한다.
  // KBO·K리그는 편성도 축약명(`두산`, `서울`)이라 대조 대상이 아니다.
  const LONG_NAME_LEAGUES = ["mlb"];
  const mismatches: string[] = [];
  for (const leagueSlug of LONG_NAME_LEAGUES) {
    for (const [short, full] of Object.entries(FULL_NAME_BY_LEAGUE[leagueSlug] ?? {})) {
      if (full === short) continue;
      if (!scheduleNames.has(full)) {
        const near = [...scheduleNames].filter((n) => n.length > 3 && n.split(" ")[0] === full.split(" ")[0]);
        mismatches.push(`${leagueSlug} "${short}" → "${full}" (편성 데이터 표기: ${near.join(" / ") || "없음"})`);
      }
    }
  }

  assert.deepEqual(mismatches, [], `정식명이 편성 데이터와 다르다:\n  ${mismatches.join("\n  ")}`);
});

/**
 * 미매핑 팀은 축약명으로 노출된다 = 검색어와 안 맞을 수 있다.
 * 실패시키지는 않되(정식명 확인이 안 된 팀을 추측으로 채우면 더 나쁘다) 목록을 남겨
 * 나중에 채울 수 있게 한다. 유럽 리그 개막 후 팀이 새로 생기면 여기 뜬다.
 */
test("미매핑 팀 목록을 기록한다", () => {
  const index = buildTeamIndex(standingsData as unknown as StandingsData);
  const missing: Record<string, string[]> = {};
  for (const t of index) {
    if (hasFullName(t.leagueSlug, t.name)) continue;
    (missing[t.leagueSlug] ??= []).push(t.name);
  }
  const total = Object.values(missing).reduce((a, b) => a + b.length, 0);
  console.log(`  [정보] 정식명 미매핑 ${total}/${index.length}팀`);
  for (const [lg, names] of Object.entries(missing)) {
    console.log(`    ${lg} (${names.length}): ${names.join(", ")}`);
  }
  // 매핑이 통째로 날아가는 회귀만 막는다(KBO·MLB는 반드시 덮여 있어야 한다).
  const kbo = index.filter((t) => t.leagueSlug === "kbo");
  if (kbo.length > 0) {
    assert.equal(
      kbo.every((t) => hasFullName("kbo", t.name)),
      true,
      "KBO 10팀은 전부 정식명이 있어야 한다",
    );
  }
});
