import { test } from "node:test";
import assert from "node:assert/strict";
import { pruneDeadEmblems } from "@/lib/standings/emblem-check";
import type { SoccerStanding, StandingsData } from "@/types/standings";

/**
 * `pruneDeadEmblems` 가드.
 *
 * 제일 중요한 건 **"404 일 때만 지운다"** 는 규칙이다. 여기가 뚫리면 pstatic 이 잠깐
 * 흔들린 크롤 한 번에 전 리그 로고가 통째로 사라진다. 아래 「404 아닌 것은 살린다」
 * 테스트가 그걸 고정한다.
 */

function team(name: string, logo: string | null): SoccerStanding {
  return {
    rank: 1,
    teamName: name,
    teamLogo: logo,
    matchesPlayed: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals: 0,
    goalsConceded: 0,
    goalsDifference: 0,
    points: 0,
    lastFive: "",
    streak: { type: "W", count: 0 },
    rankStatus: null,
  };
}

function data(teams: SoccerStanding[]): StandingsData {
  return {
    soccer: [{ id: "kleague2", name: "K리그2", season: "2026", teams }],
    baseball: [],
    basketball: [],
    lastUpdated: "2026-08-24T00:00:00.000Z",
  };
}

const DEAD = "https://sports-phinf.pstatic.net/team/kleague2/default/36.png";
const LIVE = "https://sports-phinf.pstatic.net/team/kleague2/default/31.png";
/** 대체 경로 탐색을 끄는 스텁. 안 넘기면 진짜 네트워크를 타서 테스트가 외부에 의존한다. */
const NO_FALLBACK = async () => false;

test("404 인 URL 을 쓰는 팀만 null 이 된다", async () => {
  const d = data([team("김포", DEAD), team("부천", LIVE)]);
  const r = await pruneDeadEmblems(d, async (u) => u === DEAD, NO_FALLBACK);

  assert.equal(d.soccer[0].teams[0].teamLogo, null, "죽은 URL 은 null 이어야 한다");
  assert.equal(d.soccer[0].teams[1].teamLogo, LIVE, "살아 있는 URL 은 그대로여야 한다");
  assert.deepEqual(r.dead, [DEAD]);
  assert.equal(r.cleared, 1);
  assert.equal(r.checked, 2);
});

test("🔴 404 아닌 것은 전부 살린다 — 타임아웃에 로고가 날아가면 안 된다", async () => {
  const d = data([team("김포", DEAD), team("부천", LIVE)]);
  // check 가 전부 false = 200·5xx·타임아웃·네트워크 오류 어느 쪽도 "없다"로 보지 않는다.
  const r = await pruneDeadEmblems(d, async () => false, NO_FALLBACK);

  assert.equal(d.soccer[0].teams[0].teamLogo, DEAD);
  assert.equal(d.soccer[0].teams[1].teamLogo, LIVE);
  assert.deepEqual(r.dead, []);
  assert.equal(r.cleared, 0);
});

test("같은 죽은 URL 을 쓰는 팀이 여럿이면 전부 정리된다", async () => {
  const d = data([team("김포", DEAD), team("천안", DEAD), team("부천", LIVE)]);
  const r = await pruneDeadEmblems(d, async (u) => u === DEAD, NO_FALLBACK);

  assert.equal(r.checked, 2, "고유 URL 기준으로 세야 한다(중복 요청 방지)");
  assert.equal(r.cleared, 2, "행 기준으로는 2개가 정리돼야 한다");
  assert.equal(d.soccer[0].teams[2].teamLogo, LIVE);
});

test("이미 null 인 팀은 확인 대상이 아니다", async () => {
  const d = data([team("무로고", null), team("부천", LIVE)]);
  const asked: string[] = [];
  const r = await pruneDeadEmblems(d, async (u) => {
    asked.push(u);
    return false;
  }, NO_FALLBACK);

  assert.deepEqual(asked, [LIVE]);
  assert.equal(r.checked, 1);
});

test("야구·농구 리그도 같이 훑는다", async () => {
  const d: StandingsData = {
    soccer: [],
    baseball: [
      {
        id: "kbo",
        name: "KBO",
        season: "2026",
        teams: [
          {
            rank: 1,
            teamName: "한화",
            teamLogo: DEAD,
            gameCount: 0,
            win: 0,
            draw: 0,
            lose: 0,
            winRate: 0,
            gameBehind: 0,
            lastFive: "",
            streak: { type: "W", count: 0 },
          },
        ],
      },
    ],
    basketball: [],
    lastUpdated: "2026-08-24T00:00:00.000Z",
  };
  await pruneDeadEmblems(d, async (u) => u === DEAD, NO_FALLBACK);
  assert.equal(d.baseball[0].teams[0].teamLogo, null);
});

test("죽은 kleague2 URL 은 kleague 경로가 살아 있으면 지우지 않고 갈아 끼운다", async () => {
  const ALT = "https://sports-phinf.pstatic.net/team/kleague/default/36.png";
  const d = data([team("김포", DEAD), team("부천", LIVE)]);
  const asked: string[] = [];
  const r = await pruneDeadEmblems(
    d,
    async (u) => u === DEAD,
    async (u) => {
      asked.push(u);
      return u === ALT;
    },
  );

  assert.equal(d.soccer[0].teams[0].teamLogo, ALT, "대체 경로로 되살아나야 한다");
  assert.deepEqual(asked, [ALT], "죽은 URL 에 대해서만 대체 경로를 찔러야 한다");
  assert.equal(r.cleared, 0, "되살렸으면 지운 게 아니다");
  assert.deepEqual(r.replaced, { [DEAD]: ALT });
});

test("대체 경로도 없으면 예전처럼 null 로 떨군다", async () => {
  const d = data([team("김포", DEAD)]);
  const r = await pruneDeadEmblems(d, async (u) => u === DEAD, async () => false);

  assert.equal(d.soccer[0].teams[0].teamLogo, null);
  assert.equal(r.cleared, 1);
  assert.deepEqual(r.replaced, {});
});

test("🔴 대체 경로 규칙에 안 걸리는 URL 은 찔러 보지도 않는다", async () => {
  const OTHER = "https://sports-phinf.pstatic.net/team/epl/default/99.png";
  const d = data([team("어떤팀", OTHER)]);
  const asked: string[] = [];
  await pruneDeadEmblems(d, async () => true, async (u) => (asked.push(u), true));

  assert.deepEqual(asked, [], "kleague2 가 아니면 대체 경로 후보가 없어야 한다");
  assert.equal(d.soccer[0].teams[0].teamLogo, null);
});
