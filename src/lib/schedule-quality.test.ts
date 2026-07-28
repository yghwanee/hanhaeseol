import { test } from "node:test";
import assert from "node:assert/strict";
import { isReliablyParsed, teamNameLooksUnparsed } from "./schedule-quality";
import { isRichMatch } from "./match-quality";
import scheduleData from "@/data/schedule.json";
import archiveData from "@/data/schedule-archive.json";
import worldcupData from "@/data/worldcup.json";
import type { Schedule, ScheduleData } from "@/types/schedule";

function sched(over: Partial<Schedule>): Schedule {
  return {
    id: "id-1",
    date: "2026-07-28",
    time: "18:30",
    sport: "야구",
    league: "KBO",
    homeTeam: "삼성",
    awayTeam: "두산",
    platform: "티빙",
    koreanCommentary: true,
    ...over,
  } as Schedule;
}

test("정상 편성은 통과한다", () => {
  assert.equal(isReliablyParsed(sched({})), true);
  assert.equal(isReliablyParsed(sched({ league: "프리미어리그", homeTeam: "아스널", awayTeam: "첼시" })), true);
});

test("리그가 연도만 남으면 파싱 실패로 본다", () => {
  // 실측: 올스타전 편성이 league="2026" 으로 저장돼 있었다.
  assert.equal(isReliablyParsed(sched({ league: "2026" })), false);
  assert.equal(isReliablyParsed(sched({ league: "25-26" })), false);
  assert.equal(isReliablyParsed(sched({ league: "" })), false);
});

test("팀명에 이벤트·스폰서 문구가 들어오면 파싱 실패로 본다", () => {
  assert.equal(teamNameLooksUnparsed("신한 SOL KBO 올스타전 나눔"), true);
  assert.equal(teamNameLooksUnparsed("퓨처스 챔프전 단양대회 여자부 준결승 IBK기업은행"), true);
  // 제공처가 제목을 잘라 보낸 흔적
  assert.equal(teamNameLooksUnparsed("신한 SOL KBO 올스타 프라이데이 퓨처스 올스... 북부리그"), true);
  assert.equal(teamNameLooksUnparsed(""), true);
});

test("정상인데 대회 단어를 포함하는 팀명은 통과시킨다", () => {
  // 여기가 이 판정의 핵심 위험이다. 올스타전 참가팀 이름 자체가 이렇게 생겼다.
  for (const n of [
    "나눔 올스타",
    "드림 올스타",
    "MLS 올스타",
    "LIGA MX 올스타",
    "아메리칸리그",
    "내셔널리그",
    "남부리그",
    "북부리그",
    "시카고 컵스",
    "슈가랜드 스페이스 카우보이스",
    "LG 트윈스",
    "브라이턴 앤 호브 앨비언",
  ]) {
    assert.equal(teamNameLooksUnparsed(n), false, `정상 팀명이 걸렸다: ${n}`);
  }
});

test("isRichMatch 가 파싱 실패 행을 색인에서 뺀다", () => {
  // 예정 경기라도(원래는 무조건 색인) 파싱이 깨졌으면 제외돼야 한다.
  const future = "2999-01-01";
  assert.equal(isRichMatch(sched({ date: future }), null, "2026-07-28"), true);
  assert.equal(isRichMatch(sched({ date: future, league: "2026" }), null, "2026-07-28"), false);
  assert.equal(
    isRichMatch(sched({ date: future, awayTeam: "신한 SOL KBO 올스타전 나눔" }), null, "2026-07-28"),
    false,
  );
});

test("현재 데이터에 파싱 실패 행이 없다", () => {
  // 데이터 전수 스캔. 크롤이 새 오염을 들여오면 여기서 실패한다.
  const sources: [string, ScheduleData][] = [
    ["schedule.json", scheduleData as unknown as ScheduleData],
    ["schedule-archive.json", archiveData as unknown as ScheduleData],
    ["worldcup.json", worldcupData as unknown as ScheduleData],
  ];
  const bad: string[] = [];
  for (const [label, data] of sources) {
    for (const s of data.schedules ?? []) {
      if (!isReliablyParsed(s)) {
        bad.push(`${label} ${s.date} ${s.platform} [${s.league}] ${s.homeTeam} vs ${s.awayTeam}`);
      }
    }
  }
  assert.deepEqual(bad, [], `파싱 실패 행:\n  ${bad.join("\n  ")}`);
});
