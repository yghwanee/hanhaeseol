import { test } from "node:test";
import assert from "node:assert/strict";
import scheduleData from "@/data/schedule.json";
import {
  SPORT_SEO,
  eligibleSports,
  countGames,
  leaguesOfSport,
  findSportBySlug,
  inPreseasonWindow,
  MIN_GAMES_FOR_SPORT_PAGE,
  PRESEASON_GRACE_DAYS,
  PRESEASON_OPEN_DAYS,
} from "@/lib/sport-seo";
import { LEAGUE_SEO, PLATFORM_SEO } from "@/lib/slugs";
import { LEAGUE_GUIDES } from "@/lib/league-guides";
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
 *
 * 2026-09-14 부터 **개막 전 공개**가 예외로 들어왔다. 경기 대신 확인된 개막일·중계
 * 채널을 보여 주는 페이지다. 그 예외가 빈 페이지의 뒷문이 되지 않게 아래에서 따로 막는다.
 */

const schedules = (scheduleData as unknown as ScheduleData).schedules;
const today = getTodayString();
const eligible = eligibleSports(schedules, today);

test("게이트: 경기가 충분하거나 개막 전 공개 구간인 종목만 페이지가 된다", () => {
  for (const meta of SPORT_SEO) {
    const n = countGames(schedules, meta, today);
    const listed = eligible.some((s) => s.slug === meta.slug);
    const expected = n >= MIN_GAMES_FOR_SPORT_PAGE || inPreseasonWindow(meta, today);
    assert.equal(listed, expected, `${meta.slug}: 경기 ${n}건 · 개막 전 구간 ${inPreseasonWindow(meta, today)} 인데 포함 ${listed}`);
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
 * 위의 게이트 테스트는 상수를 같이 참조해서, 임계값을 0으로 낮추면 양쪽이 같이 움직여
 * 통과해 버린다(실제로 확인했다). 그래서 "사이트맵에 오른 종목에는 보여 줄 게 실제로
 * 있어야 한다" 를 따로 못 박는다 — 경기가 있거나, 아직 지나지 않은 개막일과 중계 채널이
 * 적혀 있거나.
 */
test("사이트맵에 오른 종목은 경기 또는 유효한 개막 정보가 있다", () => {
  const empty = sitemap()
    .map((e) => e.url)
    .filter((u) => u.includes("/sport/"))
    .map((u) => u.split("/sport/")[1])
    .filter((slug) => {
      const meta = findSportBySlug(slug);
      if (!meta) return true;
      if (countGames(schedules, meta, today) > 0) return false;
      const p = meta.preseason;
      if (!p || p.broadcasters.length === 0 || !p.opener) return true;
      // 개막 후 유예를 넘긴 날짜가 남아 있으면 "곧 개막" 이 거짓이 된다.
      const daysSinceOpen = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${p.opensOn}T00:00:00Z`)) / 86_400_000;
      return daysSinceOpen > 14;
    });
  assert.deepEqual(empty, [], `보여 줄 게 없는데 사이트맵에 오른 종목: ${empty.join(", ")}`);
});

test("개막 전 공개 폭이 과하게 넓지 않다", () => {
  // 폭을 1년으로 늘리면 비시즌 내내 "곧 개막" 페이지가 된다. 상한을 절대값으로 둔다.
  assert.ok(PRESEASON_OPEN_DAYS <= 90, `개막 ${PRESEASON_OPEN_DAYS}일 전부터 공개 — 너무 이르다`);
  assert.ok(PRESEASON_GRACE_DAYS <= 21, `개막 후 ${PRESEASON_GRACE_DAYS}일 유예 — 너무 길다`);
});

test("개막 정보는 형식이 맞고 리그 페이지·리그 가이드와 어긋나지 않는다", () => {
  for (const meta of SPORT_SEO) {
    const p = meta.preseason;
    if (!p) continue;
    assert.match(p.opensOn, /^\d{4}-\d{2}-\d{2}$/, `${meta.slug}: opensOn 형식`);
    assert.ok(p.source.length > 0, `${meta.slug}: 근거가 없다`);
    assert.ok(
      LEAGUE_SEO.some((l) => l.slug === p.leagueSlug && l.sport === meta.sport),
      `${meta.slug}: /league/${p.leagueSlug} 가 없거나 종목이 다르다`,
    );
    // 개막 정보와 리그 가이드의 중계 채널이 서로 다르면 한 사이트 안에서 두 말을 한다.
    const guide = LEAGUE_GUIDES[p.leagueSlug];
    assert.ok(guide?.broadcasters, `${meta.slug}: 리그 가이드에 중계 채널이 없다`);
    for (const b of p.broadcasters) {
      assert.ok(guide!.broadcasters!.includes(b), `${meta.slug}: '${b}' 가 리그 가이드 중계 채널에 없다`);
    }
  }
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
  // 네 종목 모두 리그가 하나라도 잡혀야 한다. 0이면 매핑이 끊긴 것이다.
  for (const slug of ["baseball", "soccer", "basketball", "volleyball"]) {
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
