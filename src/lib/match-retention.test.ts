import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MATCH_RETENTION_DAYS,
  isRetiredMatchDate,
  isRetiredMatchSlug,
  matchCutoffDate,
} from "./match-retention";

/**
 * 매치 보존 기간 가드 (2026-10-07). 근거·수치는 `match-retention.ts` 머리 주석.
 * 막는 것: ①기간 계산이 KST 를 안 따르는 것 ②미들웨어 matcher 에서 `/match` 가 빠져
 * 410 이 조용히 꺼지는 것 ③미들웨어가 데이터 JSON 을 끌어와 엣지 번들이 커지는 것.
 */

// 2026-10-07 09:00 KST
const NOW = new Date("2026-10-07T00:00:00Z");

test("컷오프 = KST 오늘 - 보존 일수", () => {
  assert.equal(MATCH_RETENTION_DAYS, 14);
  assert.equal(matchCutoffDate(NOW), "2026-09-23");
});

test("KST 자정 직후는 KST 날짜로 센다 (UTC 로 세면 하루 밀린다)", () => {
  // 2026-10-07 00:30 KST = 2026-10-06 15:30 UTC
  assert.equal(matchCutoffDate(new Date("2026-10-06T15:30:00Z")), "2026-09-23");
});

test("컷오프 날짜 당일 경기는 살아 있고 그 전날부터 은퇴", () => {
  assert.equal(isRetiredMatchDate("2026-09-23", NOW), false);
  assert.equal(isRetiredMatchDate("2026-09-22", NOW), true);
  assert.equal(isRetiredMatchDate("2026-10-12", NOW), false);
});

test("슬러그 — 인코딩된 한글 슬러그도 날짜로 판정", () => {
  assert.equal(
    isRetiredMatchSlug("2026-06-04-coupang-play-%EB%8C%80%ED%95%9C%EB%AF%BC%EA%B5%AD-vs-%EC%97%90", NOW),
    true,
  );
  assert.equal(isRetiredMatchSlug("2026-09-24-coupang-play-대한민국-vs-에콰도르", NOW), false);
  assert.equal(isRetiredMatchSlug("2026-09-20-coupang-play-AT.-마드리드-vs-레알-마드리드", NOW), true);
});

test("날짜를 못 읽으면 막지 않는다", () => {
  assert.equal(isRetiredMatchSlug("not-a-date", NOW), false);
  assert.equal(isRetiredMatchDate("2026-9-1", NOW), false);
});

test("미들웨어가 /match 를 잡고 410 을 낸다", () => {
  const mw = readFileSync("src/middleware.ts", "utf8");
  assert.match(mw, /"\/match\/:path\*"/, "matcher 에 /match/:path* 가 있어야 한다");
  assert.match(mw, /isRetiredMatchSlug/);
  assert.match(mw, /status:\s*410/);
});

test("보존 모듈은 엣지에서 돈다 — node 모듈·데이터 import 금지", () => {
  const src = readFileSync("src/lib/match-retention.ts", "utf8");
  assert.doesNotMatch(src, /^import /m, "match-retention.ts 는 아무것도 import 하지 않는다");
});

test("매치 페이지도 같은 판정을 쓴다 (미들웨어 우회 안전망 + 프리렌더 제외)", () => {
  const page = readFileSync("src/app/match/[slug]/page.tsx", "utf8");
  const uses = page.match(/isRetiredMatchDate\(/g) ?? [];
  assert.ok(uses.length >= 2, "generateStaticParams 와 본문 둘 다에서 써야 한다");
});

test("서버 페이지의 지난 경기 카드는 은퇴 경기를 링크하지 않는다", () => {
  // 2026-10-07: 팀 172장·선수 13장의 지난 경기 목록이 410 링크 641개를 내고 있었다.
  for (const f of ["src/app/team/[slug]/page.tsx", "src/app/player/[slug]/page.tsx"]) {
    const src = readFileSync(f, "utf8");
    assert.match(src, /linkMatch=\{!isRetiredMatchDate\(/, `${f} 는 ScheduleCard 에 linkMatch 를 넘겨야 한다`);
  }
  const card = readFileSync("src/app/_components/ScheduleCard.tsx", "utf8");
  assert.match(card, /linkMatch && \(/, "ScheduleCard 는 linkMatch 가 false 면 매치 링크를 그리지 않는다");
});
