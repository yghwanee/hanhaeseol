import { test } from "node:test";
import assert from "node:assert/strict";
import scheduleData from "@/data/schedule.json";
import {
  SPORT_SEO,
  eligibleSports,
  countGames,
  leaguesOfSport,
  findSportBySlug,
  MIN_GAMES_FOR_SPORT_PAGE,
} from "@/lib/sport-seo";
import { LEAGUE_SEO, PLATFORM_SEO } from "@/lib/slugs";
import { STANDINGS_LEAGUES } from "@/lib/standings-seo";
import sitemap from "@/app/sitemap";
import { getTodayString } from "@/lib/schedule-utils";
import type { ScheduleData } from "@/types/schedule";

/**
 * 종목 허브(`/sport/[slug]`) 가드.
 *
 * 근거는 네이버 30일 실측(2026-08-19) — **전용 페이지가 없는데도** 종목 쿼리가
 * CTR 두 자릿수로 잡혔다(`오늘 야구 해설` 20.9% · `야구 편성표` 13.9% ·
 * `kbo 편성표` 26.1%). 라우트가 league·platform·standings·team·match·commentary·
 * guide 뿐이라 종목이 통째로 비어 있었다.
 *
 * 🔴 이 파일이 지키는 것은 "빈 페이지를 만들지 않는다" 하나다. 팀 페이지에서
 * 개막 전 유럽 138팀을 그대로 뽑았다가 "0승 0패" 페이지를 만들 뻔했다(작업58).
 */

const schedules = (scheduleData as unknown as ScheduleData).schedules;
const today = getTodayString();
const eligible = eligibleSports(schedules, today);

test("게이트를 통과한 종목만 페이지가 된다", () => {
  for (const meta of SPORT_SEO) {
    const n = countGames(schedules, meta, today);
    const listed = eligible.some((s) => s.slug === meta.slug);
    assert.equal(
      listed,
      n >= MIN_GAMES_FOR_SPORT_PAGE,
      `${meta.slug}: 경기 ${n}건인데 목록 포함 여부가 ${listed}`,
    );
  }
});

test("게이트 통과 종목이 비어 있지 않다(가드 자체 회귀 방지)", () => {
  assert.ok(
    eligible.length > 0,
    `통과 종목 0개 — 편성 데이터가 비었거나 임계값(${MIN_GAMES_FOR_SPORT_PAGE})이 너무 높다`,
  );
});

/**
 * 🔴 상수와 무관한 절대 기준.
 *
 * 위의 "게이트를 통과한 종목만" 테스트는 `MIN_GAMES_FOR_SPORT_PAGE` 를 같이
 * 참조해서, 임계값을 0으로 낮추면 양쪽이 같이 움직여 통과해 버린다(실제로
 * 확인했다). 그래서 "사이트맵에 오른 종목에는 경기가 실제로 있어야 한다" 를
 * 상수 없이 따로 못 박는다. 이게 "빈 페이지를 만들지 않는다" 의 본체다.
 */
test("사이트맵에 오른 종목은 실제 경기가 있다", () => {
  const empty = sitemap()
    .map((e) => e.url)
    .filter((u) => u.includes("/sport/"))
    .map((u) => u.split("/sport/")[1])
    .filter((slug) => {
      const meta = findSportBySlug(slug);
      return !meta || countGames(schedules, meta, today) === 0;
    });
  assert.deepEqual(empty, [], `경기 0건인데 사이트맵에 오른 종목: ${empty.join(", ")}`);
});

test("사이트맵의 종목 URL 이 게이트와 정확히 일치한다", () => {
  const inSitemap = sitemap()
    .map((e) => e.url)
    .filter((u) => u.includes("/sport/"))
    .map((u) => u.split("/sport/")[1])
    .sort();
  assert.deepEqual(
    inSitemap,
    eligible.map((s) => s.slug).sort(),
    "사이트맵과 generateStaticParams 게이트가 어긋났다",
  );
});

test("제목이 네이버 상한 40자 안이고 '해설' 이 앞쪽에 있다", () => {
  for (const meta of SPORT_SEO) {
    assert.ok(meta.title.length <= 40, `${meta.slug} 제목 ${meta.title.length}자: ${meta.title}`);
    const i = meta.title.indexOf("해설");
    assert.ok(i >= 0 && i <= 25, `${meta.slug} 제목에서 '해설' 이 ${i}번째: ${meta.title}`);
  }
});

test("match 는 편성 데이터의 sport 표기와 일치한다", () => {
  const known = new Set<string>(schedules.map((s) => s.sport));
  for (const meta of SPORT_SEO) {
    for (const m of meta.match) {
      // 비시즌 종목은 편성에 없을 수 있다. 있는 것만 표기를 검사한다.
      if (!known.has(m)) continue;
      assert.ok(
        schedules.some((s) => s.sport === m),
        `${meta.slug}: '${m}' 표기가 편성 데이터에 없다`,
      );
    }
  }
  // 반대로 편성에 있는 종목이 SPORT_SEO 에 통째로 빠져 있으면 알린다.
  const covered = new Set(SPORT_SEO.flatMap((m) => m.match));
  const missing = [...known].filter((s) => !covered.has(s));
  assert.deepEqual(missing, [], `SPORT_SEO 에 없는 종목: ${missing.join(", ")}`);
});

test("종목별 리그 목록이 실제 리그 페이지를 가리킨다", () => {
  for (const meta of SPORT_SEO) {
    for (const l of leaguesOfSport(meta)) {
      assert.ok(
        LEAGUE_SEO.some((x) => x.slug === l.slug),
        `${meta.slug} → /league/${l.slug} 가 LEAGUE_SEO 에 없다`,
      );
    }
  }
  // 축구·야구는 리그가 하나라도 잡혀야 한다. 0이면 매핑이 끊긴 것이다.
  for (const slug of ["baseball", "soccer"]) {
    const meta = findSportBySlug(slug)!;
    assert.ok(leaguesOfSport(meta).length > 0, `${slug} 에 연결된 리그가 0개`);
  }
});

test("슬러그가 기존 허브와 겹치지 않는다", () => {
  const others = new Set([
    ...LEAGUE_SEO.map((l) => l.slug),
    ...PLATFORM_SEO.map((p) => p.slug),
    ...STANDINGS_LEAGUES.map((s) => s.slug),
  ]);
  // 경로 접두사가 달라 충돌하진 않지만, 같은 이름이면 사람이 헷갈린다.
  const dup = SPORT_SEO.filter((s) => others.has(s.slug)).map((s) => s.slug);
  assert.deepEqual(dup, [], `다른 허브와 슬러그가 겹친다: ${dup.join(", ")}`);
});

test("경기 수는 채널이 아니라 경기 단위로 센다", () => {
  // 같은 경기가 여러 채널에 걸려 있어도 1로 세야 화면 카드 수와 맞는다.
  const meta = findSportBySlug("baseball")!;
  const rows = schedules.filter((s) => meta.match.includes(s.sport) && s.date >= today);
  const games = countGames(schedules, meta, today);
  assert.ok(games <= rows.length, `경기 수(${games})가 편성 행 수(${rows.length})보다 많다`);
});
