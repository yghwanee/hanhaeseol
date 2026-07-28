import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMatchTitle } from "./parsers";
import scheduleData from "@/data/schedule.json";
import archiveData from "@/data/schedule-archive.json";
import worldcupData from "@/data/worldcup.json";
import type { ScheduleData } from "@/types/schedule";

/**
 * 팀명 위생 가드.
 *
 * 2026-06-25 KBS N SPORTS 편성에 팀명이 `LG26.06.25)` 로 저장돼 있었다. 같은 경기를 티빙은
 * `LG` 로 정상 수집했으니 데이터 원천 문제가 아니라 파싱 문제였다. 오염된 팀명은 조용히
 * 여러 곳을 깨뜨린다 — 매치 슬러그, 스코어 매칭(팀명 대조), 팀 페이지 경기 목록.
 * 화면에도 그대로 노출된다.
 *
 * 아무도 에러를 못 보는 종류라 가드가 필요하다.
 */

/** 팀명에 있으면 안 되는 것: 날짜꼴, 홀로 남은 괄호, 시간꼴. */
function pollution(name: string): string | null {
  if (/\d{2}[.\-/]\d{2}[.\-/]\d{2}/.test(name)) return "날짜 조각";
  if (/^[)\]}]|[([{]$/.test(name.trim())) return "홀로 남은 괄호";
  if (/\d{1,2}:\d{2}/.test(name)) return "시간 조각";
  if (name.trim() === "") return "빈 팀명";
  return null;
}

test("파서가 날짜 조각이 붙은 팀명을 걸러낸다", () => {
  // 실제로 저장됐던 형태를 재현한다(여는 괄호 없음 → 기존 `\(.+?\)` 규칙을 통과했다).
  const r = parseMatchTitle("2026 신한 SOL KBO리그 LG26.06.25) vs 삼성");
  assert.equal(pollution(r.homeTeam), null, `homeTeam 오염: ${r.homeTeam}`);
  assert.equal(pollution(r.awayTeam), null, `awayTeam 오염: ${r.awayTeam}`);
  assert.equal(r.homeTeam, "LG");
  assert.equal(r.awayTeam, "삼성");
});

test("정상 괄호 날짜도 계속 제거된다", () => {
  const r = parseMatchTitle("2026 신한 SOL KBO리그 LG(26.06.25) vs 삼성");
  assert.equal(r.homeTeam, "LG");
  assert.equal(r.awayTeam, "삼성");
});

test("연도가 들어간 정식 구단명은 훼손하지 않는다", () => {
  // 코모 1907, 샬케 04 처럼 숫자가 이름의 일부인 구단이 있다.
  // 실제 편성 제목 형태(대괄호 리그)로 검증한다.
  const r = parseMatchTitle("[세리에A] 유벤투스 vs 코모 1907");
  assert.equal(r.homeTeam, "유벤투스");
  assert.equal(r.awayTeam, "코모 1907");
  const r2 = parseMatchTitle("[분데스리가] 샬케 04 vs 바이에른 뮌헨");
  assert.equal(r2.homeTeam, "샬케 04");
});

test("리그명이 홈팀 앞에 붙는 형태에서도 homeTeam 이 정리된다", () => {
  // 이게 실제 회귀 지점이다. 이 분기가 cleanTeam 을 건너뛰고 있었다.
  const r = parseMatchTitle("2026 신한 SOL KBO리그 LG(26.06.25) vs 삼성");
  assert.equal(r.homeTeam, "LG");
  // 농구·배구 경로도 같은 구조였다.
  const r2 = parseMatchTitle("남자프로농구 서울SK(26.01.02) vs 원주DB");
  assert.equal(pollution(r2.homeTeam), null, `homeTeam 오염: ${r2.homeTeam}`);
});

test("현재 데이터에 오염된 팀명이 없다", () => {
  const sources: [string, ScheduleData][] = [
    ["schedule.json", scheduleData as unknown as ScheduleData],
    ["schedule-archive.json", archiveData as unknown as ScheduleData],
    ["worldcup.json", worldcupData as unknown as ScheduleData],
  ];
  const bad: string[] = [];
  for (const [label, data] of sources) {
    for (const s of data.schedules ?? []) {
      for (const side of ["homeTeam", "awayTeam"] as const) {
        const why = pollution(s[side] ?? "");
        if (why) bad.push(`${label} ${s.date} ${s.platform} ${side}="${s[side]}" (${why})`);
      }
    }
  }
  assert.deepEqual(bad, [], `오염된 팀명:\n  ${bad.join("\n  ")}`);
});
