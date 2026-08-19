import { test } from "node:test";
import assert from "node:assert/strict";
import archiveData from "@/data/schedule-archive.json";
import {
  buildPlatformCommentaryStats,
  statsPeriod,
  summarySentence,
  MIN_LEAGUE_SAMPLE,
} from "@/lib/commentary-stats";
import sitemap from "@/app/sitemap";
import { buildUrlList } from "@/scripts/indexnow-ping";
import type { Schedule, ScheduleData } from "@/types/schedule";

/**
 * 플랫폼별 한국어 해설 비율 가드.
 *
 * 이 수치는 **밖으로 인용되라고** 내놓는 데이터다. 틀린 숫자를 퍼뜨리면 되돌릴 수
 * 없으므로, 산수와 미확인 처리를 고정한다.
 *
 * 🔴 핵심은 미확인(`"unknown"`) 처리다. SPOTV 는 편성의 26%, SPOTV2 는 19% 가
 * 미확인이라 분모에 넣느냐 빼느냐로 100% 와 74% 가 갈린다. 우리는 **빼고**,
 * 대신 `unknown`·`total` 을 항상 함께 노출한다. 화면에서 그 둘을 지우면 남는
 * 숫자가 오독된다.
 */

const archive = archiveData as unknown as ScheduleData;
const stats = buildPlatformCommentaryStats(archive.schedules);
const period = statsPeriod(archive.schedules);

function row(over: Partial<Schedule>): Schedule {
  return {
    id: "x",
    date: "2026-08-01",
    time: "19:00",
    sport: "야구",
    league: "KBO",
    homeTeam: "A",
    awayTeam: "B",
    platform: "티빙",
    koreanCommentary: true,
    ...over,
  } as Schedule;
}

test("산수: 비율은 확인된 건만 분모로 쓴다", () => {
  const s = buildPlatformCommentaryStats([
    row({ koreanCommentary: true }),
    row({ koreanCommentary: true }),
    row({ koreanCommentary: false }),
    row({ koreanCommentary: "unknown" }),
  ])[0];
  assert.equal(s.total, 4);
  assert.equal(s.korean, 2);
  assert.equal(s.local, 1);
  assert.equal(s.unknown, 1);
  assert.equal(s.known, 3);
  // 2/3 — 미확인 1건을 분모에 넣었다면 50% 가 된다.
  assert.ok(s.ratio !== null && Math.abs(s.ratio - 200 / 3) < 0.001);
});

test("확인된 건이 하나도 없으면 비율은 null(0% 아님)", () => {
  const s = buildPlatformCommentaryStats([
    row({ koreanCommentary: "unknown" }),
    row({ koreanCommentary: "unknown" }),
  ])[0];
  assert.equal(s.known, 0);
  assert.equal(s.ratio, null, "전부 미확인인데 0% 로 단정하면 안 된다");
});

test("실데이터: 모든 집계가 자기모순이 없다", () => {
  for (const s of stats) {
    assert.equal(s.korean + s.local + s.unknown, s.total, `${s.name} 합계 불일치`);
    assert.equal(s.known, s.korean + s.local, `${s.name} known 불일치`);
    if (s.ratio !== null) {
      assert.ok(s.ratio >= 0 && s.ratio <= 100, `${s.name} 비율 범위 이탈: ${s.ratio}`);
    }
    for (const l of s.leagues) {
      assert.equal(l.korean + l.local + l.unknown, l.total, `${s.name}/${l.name} 합계 불일치`);
      assert.ok(l.total >= MIN_LEAGUE_SAMPLE, `${s.name}/${l.name} 표본 게이트 미적용`);
    }
    // 리그 합은 플랫폼 전체를 넘을 수 없다(표본 게이트로 일부는 빠진다).
    const sum = s.leagues.reduce((n, l) => n + l.total, 0);
    assert.ok(sum <= s.total, `${s.name} 리그 합(${sum})이 전체(${s.total})보다 크다`);
  }
});

test("실데이터: 집계가 비어 있지 않다(가드 자체 회귀 방지)", () => {
  assert.ok(stats.length >= 5, `플랫폼 ${stats.length}개 — 너무 적다`);
  assert.ok(period, "기간을 못 구했다");
  const withRatio = stats.filter((s) => s.ratio !== null);
  assert.ok(withRatio.length >= 5, "비율이 나오는 플랫폼이 너무 적다");
});

test("요약 문장이 미확인 건수를 숨기지 않는다", () => {
  const s = buildPlatformCommentaryStats([
    row({ koreanCommentary: true }),
    row({ koreanCommentary: "unknown" }),
  ])[0];
  const sentence = summarySentence(s, { from: "2026-05-19", to: "2026-08-25" });
  assert.ok(sentence.includes("미확인"), `미확인을 안 밝힌다: ${sentence}`);
  assert.ok(sentence.includes("2"), `전체 건수가 없다: ${sentence}`);
  // 100% 라고만 적고 끝내면 오독된다.
  assert.ok(sentence.includes("100%"), sentence);
});

test("데이터 페이지가 사이트맵과 IndexNow 양쪽에 있다", () => {
  const url = "https://haeseol.com/commentary/stats";
  assert.ok(
    sitemap().some((e) => e.url === url),
    "사이트맵에 없다",
  );
  assert.ok(buildUrlList().includes(url), "IndexNow 통지 목록에 없다");
});

/**
 * 🔴 플랫폼명은 한글·영문이 섞여 있어(`티빙` vs `Apple TV+`) 조사를 고정하면 깨진다.
 * 실측에서 `티빙 가 100%` 가 나왔다 — 받침 ㅇ 이라 `티빙이` 가 맞다.
 * 오늘(2026-08-19) 팀 페이지·매치 본문에서도 같은 부류를 고쳤다.
 */
test("플랫폼명에 조사를 고정하지 않는다", async () => {
  const { withJosa } = await import("@/lib/josa");
  assert.equal(withJosa("티빙", "이/가"), "티빙이");
  assert.equal(withJosa("쿠팡플레이", "이/가"), "쿠팡플레이가");
  assert.equal(withJosa("Apple TV+", "이/가"), "Apple TV+가");
  assert.equal(withJosa("SPOTV NOW", "이/가"), "SPOTV NOW가");
  assert.equal(withJosa("SBS Sports", "이/가"), "SBS Sports가");
});
