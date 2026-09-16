import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import standingsData from "@/data/standings.json";
import scheduleData from "@/data/schedule.json";
import archiveData from "@/data/schedule-archive.json";
import rosterRaw from "@/data/korean-players.json";
import { buildPlayerIndex, playerIndexFor, sportOfPlayerLeague } from "@/lib/players";
import {
  buildTeamIndex,
  eligibleTeams,
  isSameTeam,
  type StandingsData,
  type TeamEntry,
} from "@/lib/teams";
import type { Schedule, ScheduleData } from "@/types/schedule";
import type { KoreanPlayer, KoreanPlayersData } from "@/lib/korean-players/types";

/**
 * 선수 페이지(`/player/[slug]`) 가드.
 *
 * 🔴 이 가드가 실제로 잡은 것 (2026-09-16, 만들면서 바로 나왔다). `isSameTeam` 이 접두
 * 매칭이라 종목으로 자르지 않으면 **두 갈래로 깨진다**. 실측으로 둘 다 확인했다:
 *
 *  A) `teams.find(...)` — 첫 매치를 쓰면 **틀린 팀이 붙는다.** 김기희(MLS 시애틀
 *     사운더스) → `mlb-시애틀`, 정상빈(MLS 세인트루이스 시티) → `mlb-세인트루이스`.
 *     화면에는 "김기희 경기 중계" 아래 MLB 경기가 깔린다.
 *  B) `filter` + 후보 유일 조건 — 후보가 2개가 되므로 **그 선수가 조용히 사라진다**
 *     (12명 → 10명). 오보는 아니지만 큰 이름의 페이지가 이유 없이 안 생긴다.
 *
 * 둘 다 타입·빌드를 통과하고, 도시명을 공유하는 미국 리그에서만 나므로 유럽 선수만
 * 보면 안 드러난다. 그래서 아래 테스트가 **A(종목 어긋남)와 B(조용한 손실)를 따로** 본다.
 */

const schedules: Schedule[] = [
  ...(scheduleData as unknown as ScheduleData).schedules,
  ...(archiveData as unknown as ScheduleData).schedules,
];
const standings = standingsData as unknown as StandingsData;
const roster = rosterRaw as KoreanPlayersData;
const teams: TeamEntry[] = eligibleTeams(buildTeamIndex(standings), schedules);

/** 로스터 신선도와 무관하게 판정한다 — 낡아서 비면 검사 자체가 사라져 버린다. */
const allPlayers: KoreanPlayer[] = roster.players;

test("선수는 자기 종목 팀에만 붙는다", () => {
  const index = buildPlayerIndex(allPlayers, teams);
  assert.ok(index.length > 0, "선수 인덱스가 비었다 — 가드 자체가 깨진 것");

  const wrong = index
    .filter((p) => p.team.sport !== sportOfPlayerLeague(p.league))
    .map((p) => `${p.name}(${p.league}) -> ${p.team.slug}(${p.team.sport})`);

  assert.deepEqual(
    wrong,
    [],
    "선수가 다른 종목 팀에 붙었다. `isSameTeam` 은 접두 매칭이라 도시명을 공유하는\n" +
      "MLS↔MLB 조합에서 통째로 일어난다(`TeamEntry.sport` 주석).\n" +
      wrong.join("\n"),
  );
});

test("종목이 겹치는 팀명도 선수를 잃지 않는다", () => {
  // 위 주석 B. 종목 필터를 빼면 `시애틀`(MLB)·`시애틀 사운더스`(MLS) 둘이 후보가 되어
  // 후보 유일 조건에 걸려 선수가 사라진다. 그 자리를 고정한다.
  const index = buildPlayerIndex(allPlayers, teams);
  const byName = new Set(index.map((p) => p.name));

  const crossSportAmbiguous = allPlayers.filter((p) => {
    const hits = teams.filter((t) =>
      p.teams.some((n) => isSameTeam(n, t.name) || isSameTeam(t.name, n)),
    );
    return new Set(hits.map((t) => t.sport)).size > 1;
  });

  // 이 목록이 비면 데이터가 바뀐 것이다 — 검사가 사라진 걸 모르고 지나가지 않게 알린다.
  assert.ok(
    crossSportAmbiguous.length > 0,
    "종목이 겹치는 팀명을 가진 선수가 없다. 데이터가 바뀌었으면 이 테스트를 다시 설계할 것 " +
      "(원래 대상: MLS 김기희=시애틀 사운더스, MLS 정상빈=세인트루이스 시티).",
  );

  const lost = crossSportAmbiguous.filter((p) => !byName.has(p.name)).map((p) => p.name);
  assert.deepEqual(
    lost,
    [],
    `종목이 겹치는 팀명 때문에 선수가 사라졌다: ${lost.join(", ")}`,
  );
});

test("한 선수는 팀 후보가 유일할 때만 페이지가 된다", () => {
  const index = buildPlayerIndex(allPlayers, teams);

  const slugs = index.map((p) => p.slug);
  assert.equal(
    new Set(slugs).size,
    slugs.length,
    `선수 슬러그가 겹친다 — 같은 URL 두 장이 된다: ${slugs.join(", ")}`,
  );

  // 이름이 겹치면(동명이인) 둘 다 버려야 한다. 한쪽만 살리면 누구의 페이지인지 알 수 없다.
  const dupNames = allPlayers
    .map((p) => p.name)
    .filter((n, i, arr) => arr.indexOf(n) !== i);
  for (const n of new Set(dupNames)) {
    assert.ok(
      !slugs.includes(n),
      `동명이인 ${n} 이 페이지로 나갔다 — 소속을 특정할 수 없으면 만들지 않는다`,
    );
  }
});

test("페이지가 되는 선수는 편성이 실제로 있다", () => {
  // 빈 페이지는 매치 페이지 1,330장이 저지른 실수다(작업58). 게이트를 통과한 선수는
  // 소속팀 편성이 최소 1건 있어야 한다.
  for (const p of playerIndexFor(schedules, standings, allPlayers)) {
    const games = schedules.filter(
      (s) =>
        s.sport === p.team.sport &&
        p.team.name.length > 0 &&
        (s.homeTeam.startsWith(p.team.name) ||
          s.awayTeam.startsWith(p.team.name) ||
          p.team.name.startsWith(s.homeTeam) ||
          p.team.name.startsWith(s.awayTeam)),
    );
    assert.ok(games.length > 0, `${p.name}(${p.team.slug}) 페이지에 편성이 하나도 없다`);
  }
});

test("로스터가 낡으면 선수 페이지가 통째로 사라진다", () => {
  // `getKoreanPlayers()` 가 빈 배열을 주는 상황을 그대로 태운다. 이게 설계다 —
  // 낡은 로스터로 소속을 주장하는 것보다 페이지가 없는 편이 낫다(작업97 오보 이력).
  assert.deepEqual(playerIndexFor(schedules, standings, []), []);
});

test("사이트맵·IndexNow·페이지가 같은 게이트 함수를 쓴다", () => {
  // 페이지는 `dynamicParams=false` 라 목록이 어긋나면 사이트맵이 404 를 올린다.
  // 셋이 각자 조건을 적는 순간 조용히 갈라지므로, 함수 이름으로 잠근다.
  for (const f of [
    "src/app/player/[slug]/page.tsx",
    "src/app/sitemap.ts",
    "src/scripts/indexnow-ping.ts",
  ]) {
    const src = readFileSync(f, "utf8");
    assert.ok(
      src.includes("playerIndexFor("),
      `${f} 가 playerIndexFor 를 안 쓴다 — 게이트가 갈라지면 사이트맵에 404 가 올라간다`,
    );
  }

  const page = readFileSync("src/app/player/[slug]/page.tsx", "utf8");
  assert.ok(
    /export const dynamicParams = false/.test(page),
    "선수 페이지의 dynamicParams 가 false 가 아니다. true 면 아무 이름이나 온디맨드로 " +
      "렌더돼 ISR write 가 열린다(매치 페이지가 그렇게 ISR Writes 의 96% 를 먹었다).",
  );
});

test("선수 페이지 제목은 이름으로 시작하고 40자 이내다", () => {
  // 네이버는 한글 제목을 30자 안팎에서 자른다. 검색 쿼리가 `<이름> 경기 중계` 형태라
  // 이름이 맨 앞에 없으면 잘린 제목에서 주어가 사라진다(작업93·89와 같은 규칙).
  for (const p of playerIndexFor(schedules, standings, allPlayers)) {
    const title = `${p.name} 경기 중계 일정 - 한국어 해설 | 한해설`;
    assert.ok(title.startsWith(p.name), title);
    assert.ok(title.length <= 40, `${title} (${title.length}자)`);
  }
});
