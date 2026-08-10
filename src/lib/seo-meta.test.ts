import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DESCRIPTION_MAX,
  buildMatchTitle,
  clampDescription,
  compactFaqs,
  buildMatchFaqs,
  buildTeamFaqs,
  dedupeSitemapEntries,
} from "./seo-meta";

test("상한 이하면 그대로 둔다", () => {
  const s = "짧은 설명입니다.";
  assert.equal(clampDescription(s), s);
});

test("상한을 넘으면 자르고 … 를 붙인다", () => {
  const long = "가".repeat(300);
  const out = clampDescription(long);
  assert.ok(out.length <= DESCRIPTION_MAX, `${out.length} <= ${DESCRIPTION_MAX}`);
  assert.ok(out.endsWith("…"));
});

test("단어 중간이 아니라 띄어쓰기 경계에서 자른다", () => {
  const s = `${"단어 ".repeat(60)}끝`;
  const out = clampDescription(s);
  assert.ok(out.length <= DESCRIPTION_MAX);
  // "단" 처럼 음절 중간에서 끊기지 않아야 한다.
  assert.ok(!/단…$/.test(out), out);
});

test("상한 안에 문장 끝이 있으면 …없이 그 문장에서 끝낸다", () => {
  const s = `${"가".repeat(120)}. ${"나".repeat(120)}`;
  const out = clampDescription(s);
  assert.ok(out.endsWith("."), out);
  assert.ok(!out.includes("…"));
});

test("공백은 하나로 정규화한다", () => {
  assert.equal(clampDescription("a   b\n\nc"), "a b c");
});

test("실제 매치 description 길이가 상한을 넘지 않는다", () => {
  // 수정 전 라이브에서 187~200자로 나가던 형태.
  const real =
    "애슬레틱스의 반등과 LA 다저스의 상승세가 맞붙는 MLB 경기 — 애슬레틱스 타선이 최근 5경기에서 타율을 크게 끌어올린 반면 다저스는 선발 로테이션이 안정되며 연승을 달리는 중이라 양쪽 흐름이 정면으로 부딪친다… 6월 10일 (수) 11:05 MLB 애슬레틱스 vs LA 다저스, SPOTV NOW에서 한국어 해설로 시청.";
  const out = clampDescription(real);
  assert.ok(out.length <= DESCRIPTION_MAX, `${out.length}`);
});

const TITLE_BASE = {
  homeTeam: "KIA 타이거즈",
  awayTeam: "SSG 랜더스",
  platform: "티빙",
  shortDate: "8월 10일",
  commentaryLabel: "한국어 해설",
};

test("🔴 매치 제목은 날짜로 시작한다 (네이버 최대 노출 쿼리가 날짜+팀명이라 잘리면 안 된다)", () => {
  const t = buildMatchTitle(TITLE_BASE);
  assert.ok(t.startsWith("8월 10일 "), t);
});

test("🔴 앞 40자 안에 날짜와 양 팀명이 모두 들어간다 (SERP 컷 지점)", () => {
  // 실측(2026-08-10) 편성+아카이브 2,190경기 중 `날짜+양팀` 구간의 최장이 36자
  // (`7월 6일 오클라호마시티 코메츠 vs 슈가랜드 스페이스 카우보이스`)였다. 그래서 40자를
  // 경계로 잡는다. 30자로는 최장 MLB·마이너 조합이 물리적으로 안 들어간다 — 팀명 자체가
  // 쿼리라 줄일 수 없으므로, 해설 라벨·플랫폼·브랜드를 그 뒤로 미는 게 할 수 있는 전부다.
  const t = buildMatchTitle({
    ...TITLE_BASE,
    homeTeam: "오클라호마시티 코메츠",
    awayTeam: "슈가랜드 스페이스 카우보이스",
    platform: "SPOTV NOW",
  });
  const head = t.slice(0, 40);
  assert.ok(head.includes("8월 10일"), head);
  assert.ok(head.includes("오클라호마시티 코메츠"), head);
  assert.ok(head.includes("슈가랜드 스페이스 카우보이스"), head);
});

test("🔴 날짜와 홈팀은 앞 30자 안에 들어간다", () => {
  const t = buildMatchTitle({
    ...TITLE_BASE,
    homeTeam: "샌프란시스코 자이언츠",
    awayTeam: "디트로이트 타이거스",
    platform: "SPOTV NOW",
  });
  const head = t.slice(0, 30);
  assert.ok(head.includes("8월 10일"), head);
  assert.ok(head.includes("샌프란시스코 자이언츠"), head);
});

test("🔴 해설 라벨·플랫폼·브랜드는 팀명보다 뒤에 온다", () => {
  const t = buildMatchTitle(TITLE_BASE);
  const away = t.indexOf("SSG 랜더스");
  for (const later of ["한국어 해설", "티빙", "한해설"]) {
    assert.ok(t.indexOf(later) > away, `${later} 가 팀명보다 앞에 있다: ${t}`);
  }
});

test("제목에 요일은 넣지 않는다 (쿼리에 없는데 4글자를 먹는다)", () => {
  assert.ok(!/\([일월화수목금토]\)/.test(buildMatchTitle(TITLE_BASE)));
});

test("🔴 해설 미확인이면 라벨을 아예 뺀다 (`해설 정보 미확인 중계` 금지)", () => {
  const t = buildMatchTitle({ ...TITLE_BASE, commentaryLabel: "" });
  assert.ok(!t.includes("미확인"), t);
  assert.ok(t.includes("중계"), t);
  // 라벨이 빠져도 이중 공백이 생기면 안 된다.
  assert.ok(!t.includes("  "), t);
});

test("해설 라벨이 있으면 제목에 그대로 실린다", () => {
  assert.ok(buildMatchTitle(TITLE_BASE).includes("한국어 해설 중계"));
  assert.ok(
    buildMatchTitle({ ...TITLE_BASE, commentaryLabel: "현지 해설" }).includes("현지 해설 중계"),
  );
});

test("팀명·플랫폼·브랜드가 모두 남는다", () => {
  const t = buildMatchTitle(TITLE_BASE);
  for (const part of ["KIA 타이거즈", "SSG 랜더스", "티빙", "한해설"]) {
    assert.ok(t.includes(part), `${part} 누락: ${t}`);
  }
});

test("빈 답변 FAQ는 구조화 데이터에서 제외된다", () => {
  const out = compactFaqs([{ q: "질문", a: "" }, { q: "", a: "답" }, { q: "q", a: "a" }, null]);
  assert.deepEqual(out, [{ q: "q", a: "a" }]);
});

test("매치 FAQ는 3문항이고 해설 여부를 정확히 반영한다", () => {
  const base = {
    homeTeam: "KIA",
    awayTeam: "LG",
    league: "KBO",
    platform: "티빙",
    dateLabel: "7월 28일 (화)",
    time: "18:30",
    commentaryLabel: "한국어 해설",
  };
  const yes = buildMatchFaqs({ ...base, koreanCommentary: true });
  assert.equal(yes.length, 3);
  assert.ok(yes[1].a.startsWith("네,"));

  const no = buildMatchFaqs({ ...base, koreanCommentary: false });
  assert.ok(no[1].a.startsWith("아니요,"));

  const unknown = buildMatchFaqs({ ...base, koreanCommentary: null });
  assert.ok(unknown[1].a.includes("확인되지 않았"));

  // Schedule.koreanCommentary 는 "확인중"을 문자열 "unknown" 으로 표현한다.
  const pending = buildMatchFaqs({ ...base, koreanCommentary: "unknown" });
  assert.ok(pending[1].a.includes("확인되지 않았"), pending[1].a);

  // 질문에 팀명이 들어가야 "KIA vs LG 어디서" 쿼리에 걸린다.
  assert.ok(yes[0].q.includes("KIA vs LG"));
});

test("팀 FAQ는 정식명을 질문에 쓴다", () => {
  const out = buildTeamFaqs({
    fullName: "두산 베어스",
    leagueName: "KBO",
    platforms: ["티빙", "SPOTV"],
    koreanRatio: { korean: 12, total: 12 },
    next: { dateLabel: "7월 29일 (수)", time: "18:30", opponent: "LG", platforms: ["티빙"] },
  });
  assert.equal(out.length, 3);
  assert.ok(out.every((f) => f.q.includes("두산 베어스")));
  assert.ok(out[1].a.includes("모두 한국어 해설"));
});

test("다음 경기가 없으면 팀 FAQ는 2문항으로 줄어든다", () => {
  const out = buildTeamFaqs({
    fullName: "키움 히어로즈",
    leagueName: "KBO",
    platforms: [],
    koreanRatio: { korean: 0, total: 0 },
    next: null,
  });
  assert.equal(out.length, 2);
  assert.ok(out[0].a.includes("확인되지 않았"));
});

test("사이트맵 중복 URL은 제거되고 우선순위 높은 쪽이 남는다", () => {
  const out = dedupeSitemapEntries([
    { url: "/a", priority: 0.7, lastModified: new Date("2026-01-01") },
    { url: "/a", priority: 0.8, lastModified: new Date("2026-01-01") },
    { url: "/b", priority: 0.7, lastModified: new Date("2026-01-01") },
  ]);
  assert.equal(out.length, 2);
  assert.equal(out.find((e) => e.url === "/a")?.priority, 0.8);
});

test("우선순위가 같으면 lastModified 최신을 남긴다", () => {
  const out = dedupeSitemapEntries([
    { url: "/a", priority: 0.7, lastModified: new Date("2026-01-01") },
    { url: "/a", priority: 0.7, lastModified: new Date("2026-06-01") },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].lastModified?.toISOString().slice(0, 10), "2026-06-01");
});

test("중복이 없으면 순서와 개수를 유지한다", () => {
  const src = [{ url: "/a", priority: 1 }, { url: "/b", priority: 1 }, { url: "/c", priority: 1 }];
  assert.deepEqual(dedupeSitemapEntries(src).map((e) => e.url), ["/a", "/b", "/c"]);
});
