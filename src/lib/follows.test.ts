import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FOLLOWS_STORAGE_KEY,
  MAX_FOLLOWS,
  isFollowedGame,
  keyTeamName,
  normalizeFollows,
  readFollows,
  teamKey,
  teamKeysOf,
  toggleFollow,
  writeFollows,
} from "./follows";
import type { Schedule } from "@/types/schedule";

function s(p: Partial<Schedule>): Schedule {
  return {
    id: "x",
    date: "2026-09-05",
    time: "18:30",
    sport: "야구",
    league: "KBO",
    homeTeam: "한화",
    awayTeam: "두산",
    platform: "티빙",
    koreanCommentary: true,
    ...p,
  } as Schedule;
}

// ── 키 ────────────────────────────────────────────────────────────────────────

test("🔴 같은 팀은 채널·시각·날짜가 달라도 같은 키다 (팀 찜의 존재 이유)", () => {
  const a = teamKey("야구", "한화");
  const b = teamKeysOf(s({ platform: "SPOTV", time: "18:15", date: "2026-09-09" }))[0];
  assert.equal(a, b);
});

test("🔴 팀명 뒤 공백·NFD 자모분리가 키를 가르지 않는다", () => {
  const clean = teamKey("야구", "한화");
  assert.equal(teamKey("야구", "한화 "), clean);
  assert.equal(teamKey("야구", "한화".normalize("NFD")), clean);
});

test("🔴 종목이 다르면 다른 팀이다 (도시명 공유 — 토론토 MLS vs MLB)", () => {
  assert.notEqual(teamKey("축구", "토론토"), teamKey("야구", "토론토"));
});

test("원정이 없는 단독 편성은 키가 하나", () => {
  assert.equal(teamKeysOf(s({ awayTeam: "" })).length, 1);
  assert.equal(teamKeysOf(s({})).length, 2);
});

test("keyTeamName 은 팀명만 꺼내고 형식이 아니면 null", () => {
  assert.equal(keyTeamName("야구|한화"), "한화");
  assert.equal(keyTeamName("한화"), null);
  assert.equal(keyTeamName("|한화"), null);
  assert.equal(keyTeamName("야구|"), null);
});

// ── 경기 매칭 ─────────────────────────────────────────────────────────────────

test("찜한 팀이 홈이든 원정이든 그 경기가 잡힌다", () => {
  const home = new Set([teamKey("야구", "한화")]);
  const away = new Set([teamKey("야구", "두산")]);
  const other = new Set([teamKey("야구", "LG")]);
  assert.equal(isFollowedGame(s({}), home), true);
  assert.equal(isFollowedGame(s({}), away), true);
  assert.equal(isFollowedGame(s({}), other), false);
});

test("찜이 비어 있으면 아무 경기도 안 잡힌다", () => {
  assert.equal(isFollowedGame(s({}), new Set()), false);
});

// ── 목록 ──────────────────────────────────────────────────────────────────────

test("중복은 접히고 정렬된다", () => {
  const out = normalizeFollows(["야구|한화", "축구|토트넘", "야구|한화"]);
  assert.deepEqual(out, ["야구|한화", "축구|토트넘"]);
});

test("형식이 깨진 키는 버린다", () => {
  assert.deepEqual(normalizeFollows(["망가진키", "야구|", "야구|한화"]), [
    "야구|한화",
  ]);
});

test(`🔴 상한 ${MAX_FOLLOWS} 을 넘으면 나중에 넣은 것부터 버린다`, () => {
  const many = Array.from({ length: MAX_FOLLOWS + 5 }, (_, i) => `야구|t${i}`);
  const out = normalizeFollows(many);
  assert.equal(out.length, MAX_FOLLOWS);
  assert.ok(out.includes("야구|t0"), "먼저 고른 팀이 살아남아야 한다");
  assert.ok(!out.includes(`야구|t${MAX_FOLLOWS + 4}`));
});

test("토글은 넣고 빼며 원본을 건드리지 않는다", () => {
  const base = ["야구|한화"];
  const added = toggleFollow(base, "축구|토트넘");
  assert.deepEqual(base, ["야구|한화"]);
  assert.equal(added.length, 2);
  assert.deepEqual(toggleFollow(added, "축구|토트넘"), ["야구|한화"]);
});

// ── 저장소 ────────────────────────────────────────────────────────────────────

test("🔴 localStorage 가 던져도 빈 목록으로 떨어지고 예외가 새지 않는다", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("SecurityError: site data blocked");
    },
  });
  try {
    assert.deepEqual(readFollows(), []);
    assert.doesNotThrow(() => writeFollows(["야구|한화"]));
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});

test("저장소에 배열이 아닌 값이 들어 있어도 빈 목록", () => {
  withStore(new Map([[FOLLOWS_STORAGE_KEY, '{"a":1}']]), () =>
    assert.deepEqual(readFollows(), []),
  );
});

test("저장 → 읽기 왕복", () => {
  withStore(new Map(), () => {
    writeFollows(["축구|토트넘", "야구|한화"]);
    assert.deepEqual(readFollows(), ["야구|한화", "축구|토트넘"]);
  });
});

function withStore(store: Map<string, string>, fn: () => void) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  });
  try {
    fn();
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete (globalThis as { localStorage?: unknown }).localStorage;
  }
}

// ── 회귀 방지 ─────────────────────────────────────────────────────────────────

test("🔴 찜을 경기 단위로 되돌리지 못하게 한다 (수명 하루짜리에 매달지 않는다)", () => {
  const src = readFileSync(join(process.cwd(), "src/lib/follows.ts"), "utf8");
  assert.ok(
    !/\bs\.date\b|\bs\.time\b|\bs\.platform\b/.test(src),
    "찜 키에 date·time·platform 이 들어가면 경기 찜으로 되돌아간 것이다",
  );
});

test("🔴 팀명을 순위표 표기로 옮기지 않는다 (alias 다리를 태우면 조용히 안 붙는다)", () => {
  const src = readFileSync(join(process.cwd(), "src/lib/follows.ts"), "utf8");
  assert.ok(
    !/isSameTeam|teamSlug|standings/i.test(src),
    "찜 키는 schedule.json 의 팀명 그대로여야 한다",
  );
});
