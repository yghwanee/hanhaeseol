import { test } from "node:test";
import assert from "node:assert/strict";
import standingsData from "@/data/standings.json";
import scheduleData from "@/data/schedule.json";
import archiveData from "@/data/schedule-archive.json";
import { buildTeamLinkMap } from "./team-links";
import { buildTeamIndex, eligibleTeams, type StandingsData } from "./teams";
import type { Schedule, ScheduleData } from "@/types/schedule";

const standings = standingsData as unknown as StandingsData;
const schedules: Schedule[] = [
  ...(scheduleData as unknown as ScheduleData).schedules,
  ...(archiveData as unknown as ScheduleData).schedules,
];

test("링크 맵은 리그 id 로 스코프된다", () => {
  const map = buildTeamLinkMap(standings, schedules);
  assert.ok(Object.keys(map).length > 0, "리그가 하나도 없다");
  // KBO 는 항상 있어야 한다(시즌 중).
  assert.ok(map.kbo, `kbo 리그가 없다. 있는 리그: ${Object.keys(map).join(", ")}`);
  assert.ok(Object.keys(map.kbo).length >= 10, "KBO 10팀이 다 링크돼야 한다");
});

test("모든 href 가 실제 존재하는 팀 페이지를 가리킨다", () => {
  // 이게 핵심 가드다. 없는 페이지로 링크를 뿌리면 404를 양산한다
  // (매치 페이지에서 이미 겪은 실수). eligibleTeams 게이트와 일치해야 한다.
  const map = buildTeamLinkMap(standings, schedules);
  const valid = new Set(
    eligibleTeams(buildTeamIndex(standings), schedules).map(
      (t) => `/team/${encodeURIComponent(t.slug)}`,
    ),
  );
  const orphans: string[] = [];
  for (const [leagueId, teams] of Object.entries(map)) {
    for (const [name, href] of Object.entries(teams)) {
      if (!valid.has(href)) orphans.push(`${leagueId} ${name} → ${href}`);
    }
  }
  assert.deepEqual(orphans, [], `존재하지 않는 팀 페이지로 링크한다:\n  ${orphans.join("\n  ")}`);
});

test("팀 페이지가 없는 팀은 링크하지 않는다", () => {
  const map = buildTeamLinkMap(standings, schedules);
  const linked = new Set(Object.values(map).flatMap((t) => Object.keys(t)));
  const allNames = new Set(
    [
      ...(standings.baseball ?? []),
      ...(standings.soccer ?? []),
      ...(standings.basketball ?? []),
    ].flatMap((l) => (l.teams ?? []).map((t) => t.teamName)),
  );
  // 개막 전 유럽 리그 팀들은 링크되지 않아야 한다(팀 페이지 자체가 없음).
  assert.ok(linked.size < allNames.size, "모든 팀이 링크됐다 — 게이트가 동작하지 않는다");
});

test("매핑 없는 리그(순위표에만 있는 리그)는 조용히 제외된다", () => {
  const fake = {
    baseball: [{ id: "nope", name: "존재하지않는리그", teams: [{ teamName: "X", rank: 1, win: 1 }] }],
    soccer: [],
  } as unknown as StandingsData;
  assert.deepEqual(buildTeamLinkMap(fake, []), {});
});
