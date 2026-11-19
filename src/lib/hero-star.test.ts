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
    home: { POINT: { playerName: "쇼", point: 86 }, SET_SUCCESS: { playerName: "이민규", point: 9 } },
    away: { POINT: { playerName: "러셀", point: 53 } },
  },
};

test("농구 NBA — 팀 득점 1위와 평균", () => {
  assert.deepEqual(starFromPreview("농구", NBA_PREVIEW, "away"), { name: "데니 아브디야", stat: "평균 23.9점" });
});

test("농구 KBL — 프리뷰에 평균 득점이 없으면 공헌도 1위", () => {
  assert.deepEqual(starFromPreview("농구", KBL_PREVIEW, "home"), { name: "이선 알바노", stat: "팀 공헌도 1위" });
});

test("배구 — POINT(득점 1위)만 쓴다. 세터의 point 를 고르지 않는다", () => {
  assert.deepEqual(starFromPreview("배구", KOVO_PREVIEW, "home"), { name: "쇼", stat: "시즌 86득점" });
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
  for (const bad of ["", " ", "1", "홀란(부상)", null, undefined, 3]) assert.equal(isPlausibleName(bad), false);
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
