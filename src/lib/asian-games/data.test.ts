import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import {
  agPhase,
  crawlDates,
  daysToOpen,
  medalsStarted,
  rankMedals,
  toAgGame,
  AG_CLOSE,
  AG_FIRST_GAME,
  AG_OPEN,
  type AsianGamesData,
} from "@/lib/asian-games/data";

/**
 * 아시안게임 허브 가드.
 *
 * 1. 순위: 네이버 rankOrder 는 메달 0개일 때 전부 1 이다 — 우리가 금·은·동으로 다시 매긴다.
 * 2. 예정 경기 0:0 을 스코어로 보여 주지 않는다.
 * 3. 크롤 날짜가 대회 기간 밖으로 새지 않는다(빈 요청 · 옛 날짜 커밋 방지).
 * 4. 커밋된 데이터 파일이 페이지를 깨뜨리지 않는 모양인지.
 */

const row = (countryName: string, gold: number, silver: number, bronze: number) => ({
  countryId: countryName,
  countryName,
  gold,
  silver,
  bronze,
  total: gold + silver + bronze,
});

test("금 → 은 → 동 순서로 매기고 완전히 같으면 공동 순위", () => {
  const r = rankMedals([row("일본", 3, 1, 0), row("대한민국", 3, 2, 0), row("중국", 5, 0, 0), row("태국", 3, 1, 0)]);
  assert.deepEqual(
    r.map((x) => `${x.rank}:${x.countryName}`),
    ["1:중국", "2:대한민국", "3:일본", "3:태국"],
  );
});

test("메달 0개면 순위표 대신 안내를 쓴다", () => {
  assert.equal(medalsStarted(rankMedals([row("가", 0, 0, 0), row("나", 0, 0, 0)])), false);
  assert.equal(medalsStarted(rankMedals([row("가", 0, 0, 1)])), true);
});

test("예정 경기와 개인 종목은 점수를 null 로 둔다", () => {
  const before = toAgGame({ gameDateTime: "2026-09-17T16:00:00", homeTeamName: "방글라데시", awayTeamName: "대한민국", homeTeamScore: 0, awayTeamScore: 0, statusCode: "BEFORE" });
  assert.equal(before.homeScore, null);
  assert.equal(before.time, "16:00");
  const live = toAgGame({ gameDateTime: "2026-09-17T16:00:00", homeTeamName: "방글라데시", awayTeamName: "대한민국", homeTeamScore: 0, awayTeamScore: 2, statusCode: "STARTED" });
  assert.equal(live.awayScore, 2);
  const solo = toAgGame({ gameDateTime: "2026-09-20T08:45:00", homeTeamName: "", awayTeamName: "", homeTeamScore: 0, statusCode: "RESULT" });
  assert.equal(solo.homeScore, null);
});

test("대회 국면과 크롤 날짜가 대회 기간 밖으로 새지 않는다", () => {
  assert.equal(agPhase("2026-09-01"), "before");
  assert.equal(agPhase(AG_FIRST_GAME), "prelim");
  assert.equal(agPhase(AG_OPEN), "live");
  assert.equal(agPhase(AG_CLOSE), "live");
  assert.equal(agPhase("2026-10-06"), "over");
  assert.equal(daysToOpen(AG_OPEN), 0);
  assert.deepEqual(crawlDates("2026-08-01"), []);
  assert.deepEqual(crawlDates("2026-11-01"), []);
  for (const d of crawlDates("2026-10-02")) assert.ok(d >= AG_FIRST_GAME && d <= AG_CLOSE, d);
});

test("커밋된 데이터 파일 모양", () => {
  const file = path.join(process.cwd(), "public", "asian-games.json");
  if (!fs.existsSync(file)) return; // 첫 크롤 전
  const data = JSON.parse(fs.readFileSync(file, "utf-8")) as AsianGamesData;
  assert.ok(data.medals.length >= 30, `참가국이 너무 적다: ${data.medals.length}`);
  for (const m of data.medals) {
    assert.equal(m.total, m.gold + m.silver + m.bronze, `${m.countryName} 합계 불일치`);
    assert.ok(m.rank >= 1);
  }
  // 파일이 커지면 GitHub raw 로 받는 방문자 부담이 커진다. 한국 경기만 담으니 넉넉한 상한.
  assert.ok(fs.statSync(file).size < 200_000, "asian-games.json 이 200KB 를 넘었다");
});
