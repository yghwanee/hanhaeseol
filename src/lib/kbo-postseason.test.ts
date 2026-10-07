import { test } from "node:test";
import assert from "node:assert/strict";
import type { Schedule } from "@/types/schedule";
import type { BaseballStanding } from "@/types/standings";
import {
  phaseOf,
  postseasonGames,
  remainingRegularGames,
  roundForMatchup,
  groupKboGames,
} from "./kbo-postseason";

/**
 * 가을야구 허브 판정 가드 (2026-10-07). 막는 것:
 *  ①라운드를 지어내는 것(5위 밖·규정에 없는 조합은 null)
 *  ②정규시즌 경기를 포스트시즌으로 세는 것(잔여 경기·비진출 팀이 낀 마지막 날)
 *  ③같은 경기를 채널 수만큼 세는 것(티빙·TV 가 각각 행을 낸다)
 */

const team = (rank: number, teamName: string, gameCount: number): BaseballStanding => ({
  rank, teamName, gameCount, teamLogo: null, win: 0, draw: 0, lose: 0, winRate: 0, gameBehind: 0, lastFive: "", streak: { type: "W", count: 1 },
} as unknown as BaseballStanding);

const NAMES = ["KT", "삼성", "KIA", "LG", "두산", "SSG", "한화", "NC", "롯데", "키움"];
const standings = (games: number) => NAMES.map((n, i) => team(i + 1, n, games));

let id = 0;
const g = (date: string, home: string, away: string, platform = "티빙", time = "18:30"): Schedule => ({
  id: String(++id), date, time, sport: "야구", league: "KBO", homeTeam: home, awayTeam: away,
  platform: platform as Schedule["platform"], koreanCommentary: true,
});

test("라운드는 시드 조합으로만 정한다", () => {
  assert.equal(roundForMatchup(4, 5), "wildcard");
  assert.equal(roundForMatchup(5, 3), "semipo");
  assert.equal(roundForMatchup(3, 4), "semipo");
  assert.equal(roundForMatchup(2, 5), "po");
  assert.equal(roundForMatchup(1, 3), "ks");
  assert.equal(roundForMatchup(4, 6), null, "5위 밖 팀이 끼면 라운드를 모른다");
  assert.equal(roundForMatchup(3, 2) , "po");
  assert.equal(roundForMatchup(undefined, 2), null);
});

test("잔여 경기 = 팀별 잔여 합의 절반", () => {
  assert.equal(remainingRegularGames(standings(144)), 0);
  const t = standings(144);
  t[0] = team(1, "KT", 141);
  t[5] = team(6, "SSG", 141);
  assert.equal(remainingRegularGames(t), 3);
  assert.equal(phaseOf(t), "regular");
  assert.equal(phaseOf(standings(144)), "postseason");
});

test("정규시즌 중에는 포스트시즌 경기가 없다", () => {
  const t = standings(143);
  assert.deepEqual(postseasonGames([g("2026-10-12", "LG", "두산")], t, "2026"), []);
});

test("비진출 팀이 낀 마지막 날 이후, 진출 팀끼리 경기만 센다 + 채널 중복 접기 + 차전", () => {
  const rows = [
    g("2026-10-12", "KT", "SSG"), // 정규시즌 마지막 날 — 비진출 팀
    g("2026-10-12", "LG", "두산"), // 같은 날 진출 팀끼리지만 정규시즌
    g("2026-10-14", "LG", "두산"),
    g("2026-10-14", "LG", "두산", "KBS N SPORTS"),
    g("2026-10-15", "LG", "두산"),
    g("2026-10-17", "KIA", "LG", "티빙", "14:00"),
  ];
  const out = postseasonGames(rows, standings(144), "2026");
  assert.equal(out.length, 3);
  assert.deepEqual(out.map((x) => [x.date, x.round, x.gameNo]), [
    ["2026-10-14", "wildcard", 1],
    ["2026-10-15", "wildcard", 2],
    ["2026-10-17", "semipo", 1],
  ]);
  assert.deepEqual(out[0].platforms.sort(), ["KBS N SPORTS", "티빙"]);
});

test("KBO 아닌 리그는 접지 않는다", () => {
  const rows = [g("2026-10-14", "LG", "두산"), { ...g("2026-10-14", "LG", "두산"), league: "MLB" }];
  assert.equal(groupKboGames(rows).length, 1);
});

test("사전 방송(15분 전 TV)과 본 중계는 한 경기, 더블헤더는 두 경기", () => {
  const rows = [
    g("2026-10-07", "LG", "두산", "SPOTV2", "18:15"),
    g("2026-10-07", "LG", "두산", "티빙", "18:30"),
    g("2026-09-20", "KT", "NC", "티빙", "13:00"),
    g("2026-09-20", "KT", "NC", "티빙", "18:00"),
  ];
  const out = groupKboGames(rows);
  assert.equal(out.length, 3);
  const lg = out.find((x) => x.homeTeam === "LG")!;
  assert.equal(lg.time, "18:30", "표시 시각은 실제 경기 시작(늦은 쪽)");
  assert.deepEqual(lg.platforms.sort(), ["SPOTV2", "티빙"]);
});
