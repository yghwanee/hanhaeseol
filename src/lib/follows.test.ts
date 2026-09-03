import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FOLLOWS_STORAGE_KEY,
  MAX_FOLLOWS,
  isFollowedGame,
  keyTeamName,
  opponentOf,
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

test("상대 팀을 홈·원정 어느 쪽에서든 바르게 집는다", () => {
  assert.equal(opponentOf(s({}), "한화"), "두산");
  assert.equal(opponentOf(s({}), "두산"), "한화");
});

test("🔴 팀명 뒤 공백이 있어도 상대를 뒤집지 않는다", () => {
  // 생 문자열로 비교하면 홈 팀을 찜했는데 상대로 **홈 팀 이름**이 나온다.
  assert.equal(opponentOf(s({ homeTeam: "한화 " }), "한화"), "두산");
  assert.equal(opponentOf(s({ homeTeam: "한화".normalize("NFD") }), "한화"), "두산");
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

test(`🔴 상한 ${MAX_FOLLOWS} 에서 방금 누른 팀이 조용히 버려지면 안 된다`, () => {
  // 오래된 것부터 버려야 한다. 반대로 하면 60팀을 채운 사용자가 별을 눌러도
  // 아무 일도 안 일어난다(무반응 클릭).
  const many = Array.from({ length: MAX_FOLLOWS + 5 }, (_, i) => `야구|t${i}`);
  const out = normalizeFollows(many);
  assert.equal(out.length, MAX_FOLLOWS);
  assert.ok(out.includes(`야구|t${MAX_FOLLOWS + 4}`), "마지막에 넣은 팀이 살아남아야 한다");
  assert.ok(!out.includes("야구|t0"), "가장 오래된 팀이 밀려나야 한다");
});

test("🔴 상한이 꽉 차도 토글은 반드시 반영된다", () => {
  const full = Array.from({ length: MAX_FOLLOWS }, (_, i) => `야구|t${i}`);
  const out = toggleFollow(full, "축구|맨체스터 시티");
  assert.ok(out.includes("축구|맨체스터 시티"), "방금 누른 팀이 목록에 있어야 한다");
  assert.equal(out.length, MAX_FOLLOWS);
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

test("🔴 발송 기록을 보내기 전에 저장한다 (중복 발송 금지)", () => {
  // 반대 순서면 저장이 실패한 실행에서 이미 나간 알림이 기록에 안 남고,
  // 다음 실행이 같은 알림을 통째로 다시 보낸다.
  const src = readFileSync(
    join(process.cwd(), "src/app/api/push/dispatch/route.ts"),
    "utf8",
  );
  const save = src.indexOf("await savePushLog");
  const send = src.indexOf("await sendPush");
  assert.ok(save > 0 && send > 0, "두 호출이 다 있어야 한다");
  assert.ok(save < send, "savePushLog 가 sendPush 보다 먼저 와야 한다");
});

test("🔴 알림 데이터를 배포본이 아니라 레포 raw 에서 읽는다", () => {
  // 배포본(public/*.json)은 하루 4번 배포까지 얼어붙는다. 득점·종료 알림이 최대
  // 6시간 늦거나 아예 안 맞는다.
  const src = readFileSync(
    join(process.cwd(), "src/app/api/push/dispatch/route.ts"),
    "utf8",
  );
  assert.match(src, /raw\.githubusercontent\.com/, "raw 를 1순위로 읽어야 한다");
  const raw = src.indexOf("raw.githubusercontent.com");
  const origin = src.indexOf('ORIGIN = "https://haeseol.com"');
  assert.ok(raw < origin || raw > 0, "raw 상수가 있어야 한다");
  assert.match(src, /\[RAW, ORIGIN\]/, "raw 를 먼저, 배포본을 폴백으로 써야 한다");
});

test("🔴 서비스워커가 같은 tag 에서 재알림을 켠다", () => {
  // 규격상 같은 tag 는 재알림 없이 교체된다. 이게 없으면 킥오프 뒤 득점 알림이 무음이다.
  const sw = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");
  assert.match(sw, /renotify/, "renotify 가 없으면 득점 알림이 조용히 교체된다");
});
