import { test } from "node:test";
import assert from "node:assert/strict";
import scheduleData from "@/data/schedule.json";
import standingsJson from "@/data/standings.json";
import { buildAnswerLead } from "@/lib/answer-lead";
import { buildStandingsLead } from "@/lib/standings-lead";
import { STANDINGS_LEAGUES } from "@/lib/standings-seo";
import { LEAGUE_SEO, PLATFORM_SEO } from "@/lib/slugs";
import { getTodayString } from "@/lib/schedule-utils";
import type { Schedule, ScheduleData } from "@/types/schedule";
import type {
  StandingsData,
  SoccerLeagueStandings,
  BaseballLeagueStandings,
} from "@/types/standings";

/**
 * 직답 리드 가드.
 *
 * 리그·플랫폼·종목·순위 페이지의 첫 문단은 답변엔진과 네이버 AI 브리핑이 문단째로 잘라
 * 가는 자리다. 여기서 나올 수 있는 사고 세 가지를 막는다.
 *
 * 1. **조사 고정** — 팀명·리그명이 그대로 꽂히는데 조사를 템플릿에 박으면 "서울와",
 *    "KT은" 이 페이지 수십 장에 박힌다(이미 매치·팀 페이지에서 두 번 겪었다).
 * 2. **기준일 누락** — 날짜 없는 수치는 인용 신뢰 판정에서 감점된다. 그리고 며칠 지난
 *    값이 조용히 그대로 보인다.
 * 3. **없는 사실** — 편성이 0건인 페이지가 "오늘 N경기" 라고 말하면 안 된다.
 *
 * 🔴 날짜를 하드코딩하지 않는다. 롤링 윈도우 데이터라 박아 두면 지나는 순간 폴백만 검사한다.
 */

const data = scheduleData as unknown as ScheduleData;
const standings = standingsJson as unknown as StandingsData;
const TODAY = getTodayString();

/** 조사가 잘못 붙은 자리. 받침 있는 말 뒤의 `와/는/가`, 받침 없는 말 뒤의 `과/은/이`. */
function josaErrors(text: string): string[] {
  const bad: string[] = [];
  // 한글 음절 + 조사 조합만 검사한다(영문·숫자 뒤는 소리로 판단할 수 없어 제외).
  const re = /([가-힣])(와|과|은|는)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const code = m[1].charCodeAt(0) - 0xac00;
    const hasFinal = code % 28 !== 0;
    const j = m[2];
    if (hasFinal && (j === "와" || j === "는")) bad.push(m[0]);
    if (!hasFinal && (j === "과" || j === "은")) bad.push(m[0]);
  }
  return bad;
}

test("편성 리드: 기준일이 문장 안에 있고 조사가 맞는다", () => {
  const cases: { kind: "league" | "platform"; display: string; match: string[] }[] = [
    ...LEAGUE_SEO.map((l) => ({ kind: "league" as const, display: l.display, match: l.match })),
    ...PLATFORM_SEO.map((p) => ({ kind: "platform" as const, display: p.display, match: p.match })),
  ];
  assert.ok(cases.length > 10, "리그·플랫폼 메타가 비었다");

  for (const c of cases) {
    const matched = data.schedules.filter((s: Schedule) =>
      c.match.includes(c.kind === "league" ? s.league : s.platform),
    );
    const lead = buildAnswerLead(c.kind, c.display, matched, TODAY);

    assert.ok(lead.includes(TODAY), `${c.display}: 기준일이 문장에 없다 — ${lead}`);
    assert.deepEqual(josaErrors(lead), [], `${c.display}: 조사 오류 — ${lead}`);

    const upcoming = matched.filter((s) => s.date >= TODAY);
    if (upcoming.length === 0) {
      // 편성이 없으면 경기 수를 말하지 않는다.
      assert.ok(
        lead.includes("중계는 없습니다"),
        `${c.display}: 편성 0건인데 없는 사실을 말한다 — ${lead}`,
      );
    }
  }
});

test("편성 리드: 오늘 경기가 없으면 다음 경기를 안내한다", () => {
  const s = (date: string, extra: Partial<Schedule> = {}): Schedule =>
    ({
      id: `${date}-x`,
      date,
      time: "19:00",
      sport: "야구",
      league: "KBO",
      homeTeam: "두산",
      awayTeam: "LG",
      platform: "티빙",
      koreanCommentary: true,
      ...extra,
    }) as Schedule;

  const tomorrow = new Date(Date.parse(`${TODAY}T00:00:00Z`) + 86400000)
    .toISOString()
    .slice(0, 10);

  const none = buildAnswerLead("league", "KBO", [], TODAY);
  assert.ok(none.includes("중계는 없습니다"), none);
  assert.ok(none.includes(TODAY), none);

  const later = buildAnswerLead("league", "KBO", [s(tomorrow)], TODAY);
  assert.ok(later.includes("다음 경기는"), later);
  assert.ok(!later.includes("오늘 중계 채널은"), later);

  const now = buildAnswerLead("league", "KBO", [s(TODAY)], TODAY);
  assert.ok(now.includes("1경기"), now);
  assert.ok(now.includes("티빙"), now);
});

test("편성 리드: 같은 경기가 여러 채널이어도 한 경기로 센다", () => {
  const row = (platform: Schedule["platform"]): Schedule =>
    ({
      id: `x-${platform}`,
      date: TODAY,
      time: platform === "SPOTV" ? "18:15" : "18:30",
      sport: "야구",
      league: "KBO",
      homeTeam: "두산",
      awayTeam: "LG",
      platform,
      koreanCommentary: true,
    }) as Schedule;

  const lead = buildAnswerLead("league", "KBO", [row("티빙"), row("SPOTV")], TODAY);
  assert.ok(lead.includes("중계는 1경기"), `채널 수만큼 부풀었다 — ${lead}`);
});

test("순위 리드: 전 리그에서 기준일·조사·정식팀명", () => {
  let checked = 0;
  for (const meta of STANDINGS_LEAGUES) {
    const league =
      meta.sport === "soccer"
        ? (standings.soccer.find((l) => l.id === meta.dataId) as SoccerLeagueStandings | undefined)
        : (standings.baseball.find((l) => l.id === meta.dataId) as
            | BaseballLeagueStandings
            | undefined);
    const lead = buildStandingsLead(meta, league, standings.lastUpdated);
    if (!league || league.teams.length === 0) {
      assert.equal(lead, null, `${meta.slug}: 데이터가 없는데 문장을 만들었다`);
      continue;
    }
    checked += 1;
    assert.ok(lead, `${meta.slug}: 순위 데이터가 있는데 문장이 없다`);
    assert.ok(/\d{4}-\d{2}-\d{2} 기준/.test(lead!), `${meta.slug}: 기준일 없음 — ${lead}`);
    assert.deepEqual(josaErrors(lead!), [], `${meta.slug}: 조사 오류 — ${lead}`);
    assert.ok(lead!.includes("선두는"), `${meta.slug}: 직답이 아니다 — ${lead}`);
  }
  assert.ok(checked >= 5, `순위 리그가 너무 적게 검사됐다 (${checked})`);
});

test("순위 리드: 기준일은 데이터 갱신 시각에서 온다(KST 변환)", () => {
  const meta = STANDINGS_LEAGUES.find((m) => m.dataId === "kbo")!;
  const league = standings.baseball.find((l) => l.id === "kbo") as BaseballLeagueStandings;
  // UTC 18:21 = KST 다음날 03:21. 날짜가 하루 앞으로 가야 한다.
  const lead = buildStandingsLead(meta, league, "2026-09-06T18:21:48.347Z");
  assert.ok(lead!.startsWith("2026-09-07 기준"), lead!);
});
