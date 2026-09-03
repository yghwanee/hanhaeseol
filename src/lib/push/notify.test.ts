import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildNotices,
  collapseByGame,
  gameKey,
  kickoffAt,
  shouldReceive,
  type Notice,
} from "./notify";
import { teamKey } from "@/lib/follows";
import { resultKey } from "@/lib/results/lookup";
import type { Schedule } from "@/types/schedule";
import type { MatchResult, ResultsData } from "@/types/results";

function s(p: Partial<Schedule> = {}): Schedule {
  return {
    id: "x",
    date: "2026-09-14",
    time: "22:30",
    sport: "축구",
    league: "프리미어리그",
    homeTeam: "맨체스터 시티",
    awayTeam: "아스날",
    platform: "쿠팡플레이",
    koreanCommentary: true,
    ...p,
  } as Schedule;
}

const KICKOFF = kickoffAt(s());

/** findResult 는 `byKey[date|categoryId|home|away]` 를 본다(프리미어리그 → epl). */
function resultsWith(r: Partial<MatchResult>): ResultsData {
  const key = resultKey("2026-09-14", "epl", "맨체스터 시티", "아스날");
  const full = { status: "live", ...r } as MatchResult;
  return { lastUpdated: "", byKey: { [key]: full } } as unknown as ResultsData;
}

function build(over: Partial<Parameters<typeof buildNotices>[0]> = {}): Notice[] {
  return buildNotices({
    schedules: [s()],
    results: null,
    now: KICKOFF - 30 * 60000,
    sent: new Set<string>(),
    lastScores: {},
    matchUrl: () => "/match/x",
    ...over,
  });
}

// ── 경기 접기 ─────────────────────────────────────────────────────────────────

test("🔴 같은 경기가 채널마다 한 행이어도 알림은 한 번만 만들어진다", () => {
  const games = collapseByGame([
    s({ platform: "쿠팡플레이", time: "22:30" }),
    s({ platform: "SPOTV", time: "22:15" }),
  ]);
  assert.equal(games.length, 1);
  assert.deepEqual(games[0].platforms, ["쿠팡플레이", "SPOTV"]);
});

test("한 채널이라도 한국어 해설이면 그 행이 대표가 된다", () => {
  const games = collapseByGame([
    s({ platform: "SPOTV", koreanCommentary: false }),
    s({ platform: "쿠팡플레이", koreanCommentary: true }),
  ]);
  assert.equal(games[0].s.koreanCommentary, true);
});

test("gameKey 에 채널·시각이 안 들어간다", () => {
  assert.equal(
    gameKey(s({ platform: "SPOTV", time: "22:15" })),
    gameKey(s({ platform: "티빙", time: "22:30" })),
  );
});

// ── 킥오프 ────────────────────────────────────────────────────────────────────

test("킥오프 1시간 안이면 알림이 나온다", () => {
  const out = build({ now: KICKOFF - 30 * 60000 });
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, "kickoff");
  assert.equal(out[0].title, "맨체스터 시티 VS 아스날");
  assert.match(out[0].body, /22:30 시작 · 쿠팡플레이 · 한국어해설/);
});

test("🔴 이미 시작한 경기에는 킥오프 알림을 안 보낸다", () => {
  assert.deepEqual(build({ now: KICKOFF + 60000 }), []);
});

test("아직 두 시간 넘게 남았으면 안 보낸다", () => {
  assert.deepEqual(build({ now: KICKOFF - 120 * 60000 }), []);
});

test("🔴 이미 보낸 킥오프는 다시 안 보낸다", () => {
  const key = `${gameKey(s())}|kickoff`;
  assert.deepEqual(build({ now: KICKOFF - 30 * 60000, sent: new Set([key]) }), []);
});

// ── 하루 전 ───────────────────────────────────────────────────────────────────

test("하루 전 예고가 나온다", () => {
  const out = build({ now: KICKOFF - 24.5 * 60 * 60000 });
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, "dayBefore");
  assert.equal(out[0].title, "내일 맨체스터 시티 VS 아스날");
  assert.match(out[0].body, /9월 14일 \(월\) 22:30/);
});

test("🔴 하루 전 예고와 킥오프 알림이 같은 실행에서 겹치지 않는다", () => {
  const a = build({ now: KICKOFF - 24.5 * 60 * 60000 }).map((n) => n.kind);
  const b = build({ now: KICKOFF - 30 * 60000 }).map((n) => n.kind);
  assert.deepEqual(a, ["dayBefore"]);
  assert.deepEqual(b, ["kickoff"]);
});

// ── 득점 ──────────────────────────────────────────────────────────────────────

test("골 합계가 늘면 득점 알림", () => {
  const out = build({
    now: KICKOFF + 30 * 60000,
    results: resultsWith({ status: "live", homeScore: 1, awayScore: 0 }),
    lastScores: {},
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, "goal");
  assert.equal(out[0].title, "맨체스터 시티 1-0 아스날");
});

test("🔴 스코어가 그대로면 안 보낸다 (크롤이 같은 값을 계속 준다)", () => {
  const out = build({
    now: KICKOFF + 30 * 60000,
    results: resultsWith({ status: "live", homeScore: 1, awayScore: 0 }),
    lastScores: { [gameKey(s())]: "1-0" },
  });
  assert.deepEqual(out, []);
});

test("🔴 스코어가 줄면 안 보낸다 (크롤 흔들림이지 득점이 아니다)", () => {
  const out = build({
    now: KICKOFF + 30 * 60000,
    results: resultsWith({ status: "live", homeScore: 1, awayScore: 0 }),
    lastScores: { [gameKey(s())]: "2-1" },
  });
  assert.deepEqual(out, []);
});

test("🔴 시작 전 0-0 은 득점이 아니다 (네이버는 시작 전에도 0-0 을 준다)", () => {
  const out = build({
    now: KICKOFF - 30 * 60000,
    results: resultsWith({ status: "scheduled", homeScore: 0, awayScore: 0 }),
  });
  assert.deepEqual(
    out.map((n) => n.kind),
    ["kickoff"],
    "kickoff 만 나와야 하고 goal 은 없어야 한다",
  );
});

test("🔴 진행 중 0-0 은 득점이 아니다 (기준선이 비어 있어도)", () => {
  // 2026-09-03 실전 dry-run 에서 "키움 0-0 SSG · 1회초" 가 실제로 나갔다.
  // 그 경기를 처음 보는 실행은 lastScores 가 비어 있어 0 > -1 이 성립해 버린다.
  const out = build({
    now: KICKOFF + 10 * 60000,
    results: resultsWith({ status: "live", homeScore: 0, awayScore: 0 }),
    lastScores: {},
  });
  assert.deepEqual(out, []);
});

test("득점자가 있으면 본문에 가장 늦은 골이 들어간다", () => {
  const out = build({
    now: KICKOFF + 30 * 60000,
    results: resultsWith({
      status: "live",
      homeScore: 2,
      awayScore: 0,
      goals: [
        { player: "홀란드", minute: 12, team: "home" },
        { player: "포든", minute: 41, team: "home" },
      ],
    } as Partial<MatchResult>),
  });
  assert.match(out[0].body, /포든 41'/);
});

// ── 종료 ──────────────────────────────────────────────────────────────────────

test("종료되면 결과 알림", () => {
  const out = build({
    now: KICKOFF + 3 * 3600000,
    results: resultsWith({ status: "finished", homeScore: 2, awayScore: 1 }),
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, "final");
  assert.equal(out[0].title, "경기 종료 · 맨체스터 시티 2-1 아스날");
});

test("승부차기는 본문에 적는다", () => {
  const out = build({
    now: KICKOFF + 3 * 3600000,
    results: resultsWith({
      status: "finished",
      homeScore: 1,
      awayScore: 1,
      homePtScore: 4,
      awayPtScore: 3,
    }),
  });
  assert.match(out[0].body, /승부차기 4-3/);
});

test("🔴 이미 보낸 종료 알림은 다시 안 보낸다", () => {
  const key = `${gameKey(s())}|final`;
  const out = build({
    now: KICKOFF + 3 * 3600000,
    results: resultsWith({ status: "finished", homeScore: 2, awayScore: 1 }),
    sent: new Set([key]),
  });
  assert.deepEqual(out, []);
});

// ── 수신 대상 ─────────────────────────────────────────────────────────────────

test("찜한 팀이 걸린 사람만 받는다", () => {
  const [n] = build({ now: KICKOFF - 30 * 60000 });
  assert.equal(shouldReceive(n, [teamKey("축구", "맨체스터 시티")]), true);
  assert.equal(shouldReceive(n, [teamKey("축구", "아스날")]), true);
  assert.equal(shouldReceive(n, [teamKey("축구", "토트넘")]), false);
  assert.equal(shouldReceive(n, []), false, "찜이 없으면 아무것도 안 받는다");
});

test("🔴 종목이 다르면 안 받는다 (도시명 공유)", () => {
  const [n] = build({ now: KICKOFF - 30 * 60000 });
  assert.equal(shouldReceive(n, [teamKey("야구", "맨체스터 시티")]), false);
});

// ── 회귀 방지 ─────────────────────────────────────────────────────────────────

test("🔴 알림 판정이 `Date.now()` 를 직접 읽지 않는다 (시각 분기는 인자로 받는다)", () => {
  const src = readFileSync(join(process.cwd(), "src/lib/push/notify.ts"), "utf8");
  assert.ok(
    !/Date\.now\(\)/.test(src),
    "판정이 실제 시계를 읽으면 그 시각에만 검증할 수 있다(작업108 감시견 버그)",
  );
});
