import { test } from "node:test";
import assert from "node:assert/strict";
import standingsJson from "@/data/standings.json";
import scheduleData from "@/data/schedule.json";
import archiveData from "@/data/schedule-archive.json";
import {
  buildTeamIndex,
  eligibleTeams,
  upcomingFor,
  opponentOf,
  type StandingsData,
} from "@/lib/teams";
import { withJosa } from "@/lib/josa";
import type { ScheduleData } from "@/types/schedule";
import { getTodayString } from "@/lib/schedule-utils";

/**
 * 팀 페이지 description 가드.
 *
 * 🔴 2026-08-19 라이브 실측에서 **자기 자신이 상대로 찍히고 있었다**:
 *   `토론토 FC 다음 경기는 8월 22일 (토) 07:50 토론토전`
 *   `세인트루이스 카디널스 다음 경기는 … 세인트루이스 카디널스전`
 *
 * 원인은 `next.awayTeam === team.name` 손수 비교였다. `team.name` 은 **순위표
 * 축약 표기**(`두산`·`서울`)이고 `next.awayTeam` 은 **편성 표기**(`두산 베어스`)라
 * 이 비교가 사실상 항상 거짓이었다. 그래서 팀이 원정일 때 awayTeam(=자기 자신)이
 * 그대로 상대로 나갔다. `opponentOf` 는 `isSameTeam` 으로 표기 차이를 흡수한다.
 *
 * 같은 파일의 JSON-LD 는 이미 `opponentOf` 를 쓰고 있었다 — 한 페이지 안에서 두
 * 방식이 공존했고 틀린 쪽만 사람 눈에 보이는 자리였다.
 */

const index = buildTeamIndex(standingsJson as unknown as StandingsData);
const schedules = [
  ...(scheduleData as unknown as ScheduleData).schedules,
  ...(archiveData as unknown as ScheduleData).schedules,
];
const teams = eligibleTeams(index, schedules);
const today = getTodayString();

test("팀 페이지가 자기 자신을 상대로 찍지 않는다", () => {
  const bad: string[] = [];
  for (const team of teams) {
    const next = upcomingFor(schedules, team, today, 1)[0];
    if (!next) continue;
    const opp = opponentOf(next, team);
    // 축약 표기끼리도, 정식 표기끼리도 같으면 안 된다.
    if (opp.name === team.name || opp.name.includes(team.name) || team.name.includes(opp.name)) {
      bad.push(`${team.slug}: ${team.name} vs ${opp.name}`);
    }
  }
  assert.deepEqual(bad, [], `자기 자신이 상대로 찍힌 팀 ${bad.length}건`);
});

test("팀이 실제로 그 경기에 들어 있다", () => {
  const bad: string[] = [];
  for (const team of teams) {
    const next = upcomingFor(schedules, team, today, 1)[0];
    if (!next) continue;
    const opp = opponentOf(next, team);
    // opponentOf 가 고른 상대는 그 경기의 홈·원정 중 하나여야 한다.
    if (opp.name !== next.homeTeam && opp.name !== next.awayTeam) {
      bad.push(`${team.slug}: ${opp.name} 은 ${next.homeTeam} vs ${next.awayTeam} 에 없다`);
    }
  }
  assert.deepEqual(bad, [], `상대 팀 해석 오류 ${bad.length}건`);
});

test("해설 라벨에 조사를 고정하지 않는다", () => {
  // `${label}로` 를 고정하면 받침 있는 라벨에서 깨진다.
  // 라이브 실측: `SPOTV2에서 해설 확인중로 중계됩니다`.
  assert.equal(withJosa("해설 확인중", "으로/로"), "해설 확인중으로");
  assert.equal(withJosa("한국어 해설", "으로/로"), "한국어 해설로");
  assert.equal(withJosa("현지 해설", "으로/로"), "현지 해설로");
  assert.equal(withJosa("해설 정보 미확인", "으로/로"), "해설 정보 미확인으로");
  // 받침 있는 K리그 팀명 — `강원가` 가 나오던 자리.
  assert.equal(withJosa("강원", "이/가"), "강원이");
  assert.equal(withJosa("서울", "이/가"), "서울이");
  assert.equal(withJosa("두산 베어스", "이/가"), "두산 베어스가");
});

test("가드 자체가 살아 있다(대상 팀이 있다)", () => {
  assert.ok(teams.length > 20, `대상 팀 ${teams.length}개 — 너무 적다`);
  const withNext = teams.filter((t) => upcomingFor(schedules, t, today, 1).length > 0);
  assert.ok(withNext.length > 0, "다음 경기가 있는 팀이 0 — 검사가 아무것도 안 본다");
});

/**
 * 🔴 종목 스코프 가드.
 *
 * `isSameTeam` 은 접두 매칭이라 `isSameTeam("토론토 블루제이스", "토론토")` 가 참이다.
 * `findTeamSchedules` 에 종목 스코프가 없던 동안, 순위표의 MLS `토론토`(=토론토 FC)가
 * MLB 토론토 경기를 자기 경기로 끌어왔다 — 라이브 실측(2026-08-19)에서 토론토 FC
 * 팀 페이지의 "다음 경기"가 **뉴욕 양키스전**으로 나왔다.
 *
 * 도시명을 공유하는 MLS↔MLB 조합에서 통째로 일어난다(뉴욕·LA·시카고·토론토…).
 *
 * 리그가 아니라 **종목**으로 자르는 이유: 컵대회(코리아컵·DFB-포칼·UCL)는 리그명이
 * 달라서, 리그로 자르면 그 경기들이 팀 페이지에서 사라진다.
 */
test("팀 페이지 경기가 그 팀의 종목만 담는다", () => {
  const bad: string[] = [];
  for (const team of teams) {
    if (!team.sport) continue;
    for (const g of upcomingFor(schedules, team, today, 6)) {
      const src = schedules.find(
        (s) => s.date === g.date && s.homeTeam === g.homeTeam && s.awayTeam === g.awayTeam,
      );
      if (src?.sport && src.sport !== team.sport) {
        bad.push(`${team.slug}(${team.sport}) ← ${src.sport} ${g.homeTeam} vs ${g.awayTeam}`);
      }
    }
  }
  assert.deepEqual(bad.slice(0, 8), [], `종목이 다른 경기 ${bad.length}건`);
});

test("모든 팀에 종목이 채워져 있다", () => {
  const missing = teams.filter((t) => !t.sport).map((t) => t.slug);
  assert.deepEqual(missing.slice(0, 5), [], `sport 없는 팀 ${missing.length}건`);
});
