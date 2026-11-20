import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadHeroStar, soccerStarFromSeason, starFromPreview, isPlausibleName } from "./hero-star";
import { STAR_EVENING_HOOKS, STAR_MORNING_HOOKS } from "./shorts-title";
import type { Schedule } from "@/types/schedule";

// 픽스처는 2026-11-20 네이버 실응답에서 필요한 필드만 옮겼다.
const NBA_PREVIEW = {
  teamTopPlayer: {
    home: { teamTopScorePlayer: { playerName: "자말 머레이", statType: "score", statValue: "24.1" } },
    away: { teamTopScorePlayer: { playerName: "데니 아브디야", statType: "score", statValue: "23.9" } },
  },
};
const KBL_PREVIEW = {
  efficiencyTop3: {
    home: [{ efficiency: 506, playerName: "이선 알바노" }, { efficiency: 485, playerName: "레이션 해먼즈" }],
    away: [{ efficiency: 300, playerName: "문유현" }],
  },
};
const KOVO_PREVIEW = {
  topPlayer: {
    home: { POINT: { playerId: "1000534", playerName: "쇼", point: 86 }, SET_SUCCESS: { playerName: "이민규", point: 9 } },
    away: { POINT: { playerId: "1000999", playerName: "러셀", point: 53 } },
  },
  playerList: {
    home: [{ playerCode: "1000534", playerName: "쉐론 베논 에반스", playerShortName: "쇼" }],
    away: [],
  },
};

test("농구 NBA — 팀 득점 1위와 평균", () => {
  assert.deepEqual(starFromPreview("농구", NBA_PREVIEW, "away"), { name: "데니 아브디야", stat: "평균 23.9점" });
});

test("농구 KBL — 프리뷰에 평균 득점이 없으면 공헌도 1위", () => {
  assert.deepEqual(starFromPreview("농구", KBL_PREVIEW, "home"), { name: "이선 알바노", stat: "팀 공헌도 1위" });
});

test("배구 — POINT(득점 1위)만 쓴다. 세터의 point 를 고르지 않는다", () => {
  assert.deepEqual(starFromPreview("배구", KOVO_PREVIEW, "away"), { name: "러셀", stat: "시즌 53득점" });
});

test("🔴 배구 한 글자 등록명(`쇼`)은 정식 이름으로 바꾼다 — 못 찾으면 선수 주어를 포기한다", () => {
  assert.deepEqual(starFromPreview("배구", KOVO_PREVIEW, "home"), { name: "쉐론 베논 에반스", stat: "시즌 86득점" });
  const noList = { topPlayer: KOVO_PREVIEW.topPlayer };
  assert.equal(starFromPreview("배구", noList, "home"), null);
});

test("WKBL 처럼 프리뷰가 비면 null — 팀명 주어로 돌아간다", () => {
  assert.equal(starFromPreview("농구", {}, "home"), null);
  assert.equal(starFromPreview("농구", null, "home"), null);
  assert.equal(starFromPreview("야구", NBA_PREVIEW, "home"), null);
});

test("축구 — 그 팀 최다 득점자, 0골이면 세우지 않는다", () => {
  const stats = [
    { playerName: "엘링 홀란", teamName: "맨체스터 시티", goals: 9, offencePoints: 10 },
    { playerName: "필 포든", teamName: "맨체스터 시티", goals: 3, offencePoints: 7 },
    { playerName: "부카요 사카", teamName: "아스날", goals: 5, offencePoints: 8 },
  ];
  const isCity = (t: string) => t === "맨체스터 시티";
  assert.deepEqual(soccerStarFromSeason(stats, isCity), { name: "엘링 홀란", stat: "시즌 9골" });
  assert.equal(soccerStarFromSeason([{ playerName: "골키퍼", teamName: "맨체스터 시티", goals: 0 }], isCity), null);
});

test("이름이 아닌 값은 주어로 못 들어간다", () => {
  for (const bad of ["", " ", "쇼", "1", "홀란(부상)", null, undefined, 3]) assert.equal(isPlausibleName(bad), false);
  assert.equal(isPlausibleName("엘링 홀란"), true);
});

function hero(over: Partial<Schedule> = {}): Schedule {
  return {
    id: "x", date: "2026-11-21", time: "21:30", sport: "축구", league: "프리미어리그",
    homeTeam: "맨시티", awayTeam: "풀럼", platform: "쿠팡플레이", koreanCommentary: true, ...over,
  };
}

test("🔴 다른 경기의 선수 파일은 쓰지 않는다 — 어제 선수가 오늘 주어가 되면 오보다", () => {
  const f = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "hero-star-")), "hero-star.json");
  fs.writeFileSync(f, JSON.stringify({
    date: "2026-11-21", home: "맨시티", away: "풀럼", name: "엘링 홀란", team: "맨시티", stat: "시즌 9골", source: "t",
  }));
  assert.equal(loadHeroStar(hero(), f)?.name, "엘링 홀란");
  assert.equal(loadHeroStar(hero({ date: "2026-11-22" }), f), null);
  assert.equal(loadHeroStar(hero({ awayTeam: "아스날" }), f), null);
  assert.equal(loadHeroStar(hero(), f + ".none"), null);
  // 선수 팀이 두 팀 중 하나가 아니면 버린다
  fs.writeFileSync(f, JSON.stringify({
    date: "2026-11-21", home: "맨시티", away: "풀럼", name: "엘링 홀란", team: "리버풀", stat: "시즌 9골", source: "t",
  }));
  assert.equal(loadHeroStar(hero(), f), null);
});

test("🔴 선수 후킹은 근거 없는 수식(에이스·득점왕·MVP)을 붙이지 않고, 이름·시각·한국어 중계를 다 담는다", () => {
  const c = {
    name: "이선 알바노", team: "원주 DB", stat: "팀 공헌도 1위", matchup: "원주 DB vs 안양 정관장",
    time: "저녁 7시", platform: "티빙", emoji: "🏀", dayWord: "내일" as const,
  };
  for (const h of [...STAR_MORNING_HOOKS, ...STAR_EVENING_HOOKS]) {
    const s = h(c);
    assert.doesNotMatch(s, /에이스|득점왕|MVP|최고/, s);
    assert.match(s, /이선 알바노/, s);
    assert.match(s, /저녁 7시/, s);
    assert.match(s, /한국어 (중계|해설)/, s);
    assert.ok(s.length <= 80, `제목 여유(날짜 꼬리 포함 100자) — ${s.length}: ${s}`);
  }
  // 아침·저녁 같은 칸이 같은 문장이 되면 안 된다(피드 배포 중단 재발 방지)
  STAR_MORNING_HOOKS.forEach((h, i) => assert.notEqual(h(c), STAR_EVENING_HOOKS[i](c)));
});

// ── 팀 경기(선수 주어 없음) — 2026-11-20 ──────────────────────────────
import { factForTeam } from "./team-fact";
import { TEAM_EVENING_HOOKS, TEAM_MORNING_HOOKS } from "./shorts-title";

test("팀 사실 — 3연승·3연패 이상, 아니면 3위 이내. NBA·MLB 는 순위를 안 쓴다", () => {
  assert.equal(factForTeam({ rank: 7, gameCount: 10, streak: { type: "W", count: 5 } }, "kbl"), "5연승");
  assert.equal(factForTeam({ rank: 7, gameCount: 10, streak: { type: "L", count: 3 } }, "kovo"), "3연패");
  assert.equal(factForTeam({ rank: 1, gameCount: 10, streak: { type: "W", count: 1 } }, "epl"), "1위");
  assert.equal(factForTeam({ rank: 1, gameCount: 10, streak: { type: "W", count: 1 } }, "nba"), null);
  assert.equal(factForTeam({ rank: 4, gameCount: 10, streak: { type: "W", count: 2 } }, "epl"), null);
  // 시즌 초(2경기 이하)는 순위·연승이 의미 없다
  assert.equal(factForTeam({ rank: 1, gameCount: 2, streak: { type: "W", count: 2 } }, "epl"), null);
});

test("🔴 팀 후킹은 팀명 하나가 아니라 매치업을 담는다 — 사실이 있든 없든", () => {
  const base = { matchup: "하나은행 vs 삼성생명 블루밍스", time: "저녁 7시", platform: "티빙", emoji: "🏀" };
  const facts = [null, { team: "하나은행", fact: "5연승" }, { team: "하나은행", fact: "3연패" }];
  for (const fact of facts) {
    for (const [pool, dayWord] of [[TEAM_MORNING_HOOKS, "오늘"], [TEAM_EVENING_HOOKS, "내일"]] as const) {
      for (const h of pool) {
        const s = h({ ...base, fact, dayWord });
        assert.match(s, /하나은행 vs 삼성생명 블루밍스/, s);
        assert.match(s, /저녁 7시/, s);
        assert.match(s, /한국어 (중계|해설)/, s);
        assert.doesNotMatch(s, /연패 이어갈까/, s);
        assert.ok(s.length <= 80, `${s.length}: ${s}`);
      }
    }
    TEAM_MORNING_HOOKS.forEach((h, i) =>
      assert.notEqual(h({ ...base, fact, dayWord: "오늘" }), TEAM_EVENING_HOOKS[i]({ ...base, fact, dayWord: "오늘" })),
    );
  }
});

// ── WKBL: 프리뷰가 비어 직전 경기 기록을 쓴다 — 2026-11-20 ─────────────
import { starFromRecord } from "./hero-star";
import { sameTeam } from "./team-fact";

test("🔴 WKBL 직전 경기 득점 1위 (11/15 삼성생명 실기록)", () => {
  const rec = {
    homePlayerStats: [
      { playerName: "강유림", scoreTot: 21 },
      { playerName: "미야사카 모모나", scoreTot: 20 },
      { playerName: "최예슬", scoreTot: 8 },
    ],
    awayPlayerStats: [{ playerName: "안혜지", scoreTot: 20 }],
  };
  assert.deepEqual(starFromRecord(rec, "home"), { name: "강유림", stat: "지난 경기 21점" });
  assert.deepEqual(starFromRecord(rec, "away"), { name: "안혜지", stat: "지난 경기 20점" });
  // NBA 기록 필드도 읽는다
  assert.deepEqual(
    starFromRecord({ homePlayerStats: [{ firstName: "자이언", lastName: "윌리엄슨", pts: 26 }] }, "home"),
    { name: "자이언 윌리엄슨", stat: "지난 경기 26점" },
  );
  // 10점 미만이면 세우지 않는다
  assert.equal(starFromRecord({ homePlayerStats: [{ playerName: "김아름", scoreTot: 9 }] }, "home"), null);
  assert.equal(starFromRecord(null, "home"), null);
});

test("편성 `삼성생명 블루밍스` ↔ 네이버 `삼성생명` 은 같은 팀, 남의 팀은 아니다", () => {
  assert.equal(sameTeam("WKBL", "삼성생명 블루밍스", "삼성생명"), true);
  assert.equal(sameTeam("WKBL", "신한은행 에스버드", "신한은행"), true);
  assert.equal(sameTeam("WKBL", "하나은행", "하나은행"), true);
  assert.equal(sameTeam("WKBL", "하나은행", "삼성생명"), false);
  assert.equal(sameTeam("KBL", "서울 SK", "SK"), false); // 3글자 미만은 접두 비교 안 함
});
