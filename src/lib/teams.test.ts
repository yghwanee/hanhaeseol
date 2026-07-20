import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasMeaningfulData,
  teamSlug,
  buildTeamIndex,
  isSameTeam,
  upcomingFor,
  recentFor,
  platformsFor,
  koreanCommentaryRatio,
  leagueSiblings,
  eligibleTeams,
  groupGames,
  opponentOf,
  findOpponentEntry,
  standingContext,
  recentFormText,
  type StandingsData,
  type TeamEntry,
} from "./teams";
import type { Schedule } from "@/types/schedule";

const STANDINGS: StandingsData = {
  baseball: [
    {
      name: "KBO",
      teams: [
        {
          rank: 1,
          teamName: "삼성",
          gameCount: 88,
          win: 53,
          draw: 2,
          lose: 33,
          winRate: 0.616,
          gameBehind: 0,
          lastFive: "LWWWL",
          streak: { type: "L", count: 1 },
        },
        { rank: 2, teamName: "KT", gameCount: 87, win: 51, draw: 1, lose: 35, winRate: 0.593 },
      ],
    },
  ],
  soccer: [
    {
      // 개막 전이라 전부 0 — 실제 2026-07-20 데이터 모양이다
      name: "프리미어리그",
      teams: [
        { rank: 1, teamName: "아스널", matchesPlayed: null, wins: 0, draws: 0, losses: 0, points: 0 },
        { rank: 2, teamName: "리버풀", matchesPlayed: null, wins: 0, draws: 0, losses: 0, points: 0 },
      ],
    },
    {
      name: "K리그",
      teams: [{ rank: 1, teamName: "울산", matchesPlayed: 22, wins: 12, draws: 6, losses: 4, points: 42 }],
    },
    {
      // 매핑에 없는 리그는 통째로 건너뛴다
      name: "에콰도르 세리에A",
      teams: [{ rank: 1, teamName: "어떤팀", matchesPlayed: 10, wins: 5, draws: 2, losses: 3 }],
    },
  ],
};

function sched(over: Partial<Schedule>): Schedule {
  return {
    id: Math.random().toString(36),
    date: "2026-07-21",
    time: "18:30",
    sport: "야구",
    league: "KBO",
    homeTeam: "삼성 라이온즈",
    awayTeam: "두산 베어스",
    platform: "티빙",
    koreanCommentary: true,
    ...over,
  } as Schedule;
}

const SAMSUNG: TeamEntry = {
  slug: "kbo-삼성",
  leagueSlug: "kbo",
  leagueName: "KBO",
  name: "삼성",
  rank: 1,
  played: 88,
  win: 53,
  draw: 2,
  lose: 33,
};

test("hasMeaningfulData: 한 경기도 안 치른 팀은 뺀다", () => {
  assert.equal(hasMeaningfulData({ rank: 1, teamName: "삼성", gameCount: 88, win: 53 }), true);
  assert.equal(
    hasMeaningfulData({ rank: 1, teamName: "아스널", matchesPlayed: null, wins: 0, draws: 0, losses: 0 }),
    false,
  );
  // 경기수 필드가 없어도 승패가 있으면 살린다
  assert.equal(hasMeaningfulData({ rank: 3, teamName: "울산", wins: 12, losses: 4 }), true);
});

test("teamSlug: 리그를 앞에 붙이고 공백은 하이픈으로", () => {
  assert.equal(teamSlug("kbo", "삼성"), "kbo-삼성");
  assert.equal(teamSlug("mlb", "LA 다저스"), "mlb-LA-다저스");
});

test("buildTeamIndex: 개막 전 리그와 매핑 없는 리그를 제외한다", () => {
  const index = buildTeamIndex(STANDINGS);
  const names = index.map((t) => t.name);

  assert.deepEqual(names.sort(), ["KT", "삼성", "울산"].sort());
  // EPL은 통째로 빠져야 한다(0승 0패 페이지 138개를 막는 게 이 규칙의 목적)
  assert.ok(!names.includes("아스널"));
  // 매핑에 없는 리그도 빠진다
  assert.ok(!names.includes("어떤팀"));

  const samsung = index.find((t) => t.name === "삼성")!;
  assert.equal(samsung.slug, "kbo-삼성");
  assert.equal(samsung.played, 88);
  assert.equal(samsung.lastFive, "LWWWL");

  // 축구는 matchesPlayed/wins 쪽 필드를 읽어야 한다
  const ulsan = index.find((t) => t.name === "울산")!;
  assert.equal(ulsan.played, 22);
  assert.equal(ulsan.win, 12);
  assert.equal(ulsan.points, 42);
});

test("isSameTeam: 표기 차이를 흡수하되 다른 팀은 안 엮는다", () => {
  assert.ok(isSameTeam("삼성", "삼성 라이온즈"));
  assert.ok(isSameTeam("LA 다저스", "LA다저스"));
  assert.ok(isSameTeam("미네소타", "미네소타 트윈스"));
  // 같은 도시 다른 팀이 엮이면 안 된다
  assert.ok(!isSameTeam("LA 다저스", "LA 에인절스"));
  assert.ok(!isSameTeam("두산", "삼성"));
});

test("upcomingFor / recentFor: 오늘 기준으로 가르고 정렬한다", () => {
  const schedules = [
    sched({ date: "2026-07-19", time: "18:30" }),
    sched({ date: "2026-07-21", time: "18:30" }),
    sched({ date: "2026-07-22", time: "17:00" }),
    sched({ date: "2026-07-18", time: "14:00" }),
    sched({ date: "2026-07-21", time: "18:30", homeTeam: "KT 위즈", awayTeam: "LG 트윈스" }),
  ];

  const up = upcomingFor(schedules, SAMSUNG, "2026-07-20");
  assert.equal(up.length, 2);
  assert.equal(up[0].date, "2026-07-21");
  assert.equal(up[1].date, "2026-07-22");

  const recent = recentFor(schedules, SAMSUNG, "2026-07-20");
  assert.equal(recent.length, 2);
  assert.equal(recent[0].date, "2026-07-19");
});

test("platformsFor: 자주 중계한 순으로", () => {
  const schedules = [
    sched({ platform: "티빙" }),
    sched({ platform: "티빙" }),
    sched({ platform: "SPOTV" }),
  ];
  assert.deepEqual(platformsFor(schedules, SAMSUNG), ["티빙", "SPOTV"]);
});

test("koreanCommentaryRatio: 한국어 해설 비율", () => {
  const schedules = [
    sched({ date: "2026-07-21", koreanCommentary: true }),
    sched({ date: "2026-07-22", koreanCommentary: false }),
    sched({ date: "2026-07-23", koreanCommentary: true }),
  ];
  assert.deepEqual(koreanCommentaryRatio(schedules, SAMSUNG), { total: 3, korean: 2 });
});

test("eligibleTeams: 국내 중계가 한 번도 없는 팀은 페이지를 안 만든다", () => {
  const index = buildTeamIndex(STANDINGS);
  // 삼성 경기만 있고 KT·울산 경기는 없는 상황
  const schedules = [sched({ homeTeam: "삼성 라이온즈", awayTeam: "롯데 자이언츠" })];
  const eligible = eligibleTeams(index, schedules);

  assert.deepEqual(eligible.map((t) => t.name), ["삼성"]);
});

test("leagueSiblings: 같은 리그 다른 팀만 순위순으로", () => {
  const index = buildTeamIndex(STANDINGS);
  const samsung = index.find((t) => t.name === "삼성")!;
  const sibs = leagueSiblings(index, samsung);

  assert.deepEqual(sibs.map((t) => t.name), ["KT"]);
  assert.ok(!sibs.some((t) => t.slug === samsung.slug));
});

test("groupGames: 같은 경기가 플랫폼별로 여러 줄이면 하나로 묶는다", () => {
  // 실제로 KIA 페이지에 "7월 21일 KIA vs 한화"가 네 줄 찍혔다(2026-07-20)
  const schedules = [
    sched({ date: "2026-07-21", time: "18:30", homeTeam: "KIA", awayTeam: "한화", platform: "티빙" }),
    sched({ date: "2026-07-21", time: "18:30", homeTeam: "KIA", awayTeam: "한화", platform: "MBC SPORTS+" }),
    sched({
      date: "2026-07-21",
      time: "18:30",
      homeTeam: "KIA",
      awayTeam: "한화",
      platform: "티빙",
      koreanCommentary: false,
    }),
    sched({ date: "2026-07-22", time: "18:30", homeTeam: "KIA", awayTeam: "한화", platform: "티빙" }),
  ];

  const games = groupGames(schedules);
  assert.equal(games.length, 2);
  assert.deepEqual(games[0].platforms, ["티빙", "MBC SPORTS+"]);
  // 한 곳이라도 한국어 해설이면 한국어로 볼 수 있다
  assert.equal(games[0].koreanCommentary, true);
});

test("koreanCommentaryRatio: 플랫폼 행이 아니라 경기 수로 센다", () => {
  const schedules = [
    sched({ date: "2026-07-21", platform: "티빙" }),
    sched({ date: "2026-07-21", platform: "SPOTV" }),
    sched({ date: "2026-07-22", platform: "티빙", koreanCommentary: false }),
  ];
  assert.deepEqual(koreanCommentaryRatio(schedules, SAMSUNG), { total: 2, korean: 1 });
});

test("opponentOf: 홈이든 원정이든 반대편을 준다", () => {
  const games = groupGames([
    sched({ date: "2026-07-21", homeTeam: "삼성 라이온즈", awayTeam: "두산 베어스" }),
    sched({ date: "2026-07-22", homeTeam: "롯데 자이언츠", awayTeam: "삼성 라이온즈" }),
  ]);
  assert.deepEqual(opponentOf(games[0], SAMSUNG), { name: "두산 베어스", home: true });
  assert.deepEqual(opponentOf(games[1], SAMSUNG), { name: "롯데 자이언츠", home: false });
});

test("findOpponentEntry: 표기가 달라도 순위표에서 상대를 찾는다", () => {
  const index = buildTeamIndex(STANDINGS);
  // 순위표는 "KT", 편성표는 "KT 위즈"
  const found = findOpponentEntry(index, SAMSUNG, "KT 위즈");
  assert.equal(found?.name, "KT");
  // 다른 리그 팀은 안 잡힌다
  assert.equal(findOpponentEntry(index, SAMSUNG, "울산"), undefined);
});

test("standingContext: 야구는 게임차, 축구는 승점차", () => {
  assert.equal(standingContext({ ...SAMSUNG, rank: 1, gameBehind: 0 }), "KBO 선두");
  assert.equal(standingContext({ ...SAMSUNG, rank: 3, gameBehind: 4.5 }), "선두와 4.5경기 차");

  const leader = { ...SAMSUNG, name: "서울", rank: 1, points: 45, gameBehind: undefined };
  const chaser = { ...SAMSUNG, name: "강원", rank: 2, points: 31, gameBehind: undefined };
  // 조사가 붙어야 한다: 서울 + 과
  assert.equal(standingContext(chaser, leader), "선두 서울과 승점 14 차");
});

test("recentFormText: WWLDW를 사람 말로", () => {
  assert.equal(recentFormText("WWLDW"), "최근 5경기 3승 1무 1패");
  assert.equal(recentFormText("WWWWW"), "최근 5경기 5승 0패");
  assert.equal(recentFormText(undefined), null);
});
