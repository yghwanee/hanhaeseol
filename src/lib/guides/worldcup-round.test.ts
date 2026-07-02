import { test } from "node:test";
import assert from "node:assert/strict";
import {
  type WcSchedule,
  selectTargetRound,
  selectTargetRounds,
  buildArticle,
  refreshArticle,
  renderDataBlock,
  addDays,
  kstTodayISO,
  DATA_START,
  DATA_END,
} from "./worldcup-round";

function sched(
  round: string,
  date: string,
  time: string,
  home: string,
  away: string,
): WcSchedule {
  return {
    id: `${round}-${date}-${time}`,
    date,
    time,
    sport: "축구",
    league: `북중미 월드컵 ${round}`,
    homeTeam: home,
    awayTeam: away,
    platform: "JTBC",
    koreanCommentary: true,
  };
}

// 실제 데이터와 유사한 픽스처: 32강(진행 중) + 16강(일부 미정)
const FIXTURE: WcSchedule[] = [
  sched("32강", "2026-07-03", "04:00", "스페인", "오스트리아"),
  sched("32강", "2026-07-04", "07:00", "아르헨티나", "카보베르데"),
  sched("16강", "2026-07-05", "02:00", "캐나다", "모로코"),
  sched("16강", "2026-07-06", "09:00", "멕시코", "잉글랜드"),
  sched("16강", "2026-07-07", "04:00", "미정", "스페인"),
  sched("16강", "2026-07-08", "01:00", "미정", "미정"),
  sched("8강", "2026-07-10", "05:00", "미정", "미정"),
];

test("addDays: 경계 넘는 날짜 계산", () => {
  assert.equal(addDays("2026-07-05", -2), "2026-07-03");
  assert.equal(addDays("2026-07-31", 1), "2026-08-01");
});

test("kstTodayISO: UTC를 KST 날짜로 (경계)", () => {
  // 2026-07-02 15:30 UTC = 2026-07-03 00:30 KST
  assert.equal(kstTodayISO(new Date("2026-07-02T15:30:00Z")), "2026-07-03");
});

test("selectTargetRound: 16강 D-2(7/3)에 16강 선택", () => {
  const t = selectTargetRound(FIXTURE, "2026-07-03");
  assert.ok(t);
  assert.equal(t!.round, "16강");
  assert.equal(t!.matches.length, 4);
  // 정렬 확인
  assert.equal(t!.matches[0].homeTeam, "캐나다");
});

test("selectTargetRound: D-3(7/2)엔 아직 대상 없음", () => {
  assert.equal(selectTargetRound(FIXTURE, "2026-07-02"), null);
});

test("selectTargetRound: 16강 종료 다음날(7/9)엔 8강으로 이동", () => {
  const t = selectTargetRound(FIXTURE, "2026-07-09");
  assert.ok(t);
  assert.equal(t!.round, "8강");
});

test("selectTargetRound: 32강은 자동 대상이 아니다", () => {
  // 7/3은 32강도 진행 중이지만 16강이 선택돼야 함(32강 제외 규칙)
  const t = selectTargetRound(FIXTURE, "2026-07-03");
  assert.equal(t!.round, "16강");
});

// 실제 대회 막판: 3·4위전(7/19)·결승(7/20) 단일 경기가 연달아 붙는다.
const FINALE: WcSchedule[] = [
  sched("4강", "2026-07-15", "04:00", "미정", "미정"),
  sched("4강", "2026-07-16", "04:00", "미정", "미정"),
  sched("3·4위전", "2026-07-19", "06:00", "미정", "미정"),
  sched("결승", "2026-07-20", "04:00", "미정", "미정"),
];

test("selectTargetRounds: 결승 D-2(7/18)에 결승이 창에 포함(3·4위전에 안 밀림)", () => {
  // 7/18 = 결승(7/20) D-2. 3·4위전(7/19)도 아직 창 안.
  const rounds = selectTargetRounds(FINALE, "2026-07-18").map((r) => r.round);
  assert.ok(rounds.includes("결승"), "결승이 D-2에 창에 있어야 함");
  assert.ok(rounds.includes("3·4위전"), "3·4위전도 아직 창 안");
});

test("selectTargetRounds: 결승 경기 당일 전에 이미 발행 창 진입", () => {
  // 7/18·7/19 모두 결승이 창 안이어야 경기(7/20 04:00) 전에 글이 뜬다.
  assert.ok(selectTargetRounds(FINALE, "2026-07-18").some((r) => r.round === "결승"));
  assert.ok(selectTargetRounds(FINALE, "2026-07-19").some((r) => r.round === "결승"));
});

test("renderDataBlock: 표 + 미정 안내(피더 라운드 언급)", () => {
  const t = selectTargetRound(FIXTURE, "2026-07-03")!;
  const block = renderDataBlock(t, FIXTURE);
  assert.ok(block.startsWith(DATA_START));
  assert.ok(block.trimEnd().endsWith(DATA_END));
  assert.ok(block.includes("| 날짜 | 한국시간 | 대진 | 중계 |"));
  assert.ok(block.includes("미정 vs 스페인"));
  assert.ok(block.includes("2개")); // 미정 경기 2개(7/7·7/8)
  assert.ok(block.includes("32강")); // 피더 라운드 언급
});

test("buildArticle: frontmatter·본문·톤 규칙", () => {
  const t = selectTargetRound(FIXTURE, "2026-07-03")!;
  const { slug, markdown } = buildArticle(t, FIXTURE, "2026-07-03");
  assert.equal(slug, "worldcup-round-of-16");
  assert.ok(markdown.startsWith("---\n"));
  assert.ok(markdown.includes("title: 월드컵 16강 일정·중계 총정리"));
  assert.ok(markdown.includes("date: 2026-07-03"));
  assert.ok(markdown.includes("category: 월드컵"));
  assert.ok(markdown.includes("haeseol.com/worldcup"));
  // AI 티 금지: 줄표(em/en dash, 한글 세로줄) 없어야 함
  assert.ok(!/[—–ㅡ]/.test(markdown), "줄표가 들어가면 안 됨");
});

test("refreshArticle: 마커 구간만 갱신, 도입/마무리 보존", () => {
  const t = selectTargetRound(FIXTURE, "2026-07-03")!;
  const original = buildArticle(t, FIXTURE, "2026-07-03").markdown;

  // 미정이 확정된 새 데이터(7/7 04:00 경기 상대가 프랑스로 확정)
  const resolved = FIXTURE.map((s) =>
    s.league.endsWith("16강") && s.homeTeam === "미정" && s.time === "04:00"
      ? { ...s, homeTeam: "프랑스" }
      : s,
  );

  const refreshed = refreshArticle(original, selectTargetRound(resolved, "2026-07-04")!, resolved, "2026-07-04");
  assert.ok(refreshed);
  assert.ok(refreshed!.includes("프랑스 vs 스페인"), "확정 팀이 반영돼야 함");
  assert.ok(refreshed!.includes("updated: 2026-07-04"), "updated 갱신");
  assert.ok(refreshed!.includes("date: 2026-07-03"), "최초 발행일은 보존");
  assert.ok(refreshed!.includes("토너먼트라 한 번 지면"), "도입 문단 보존");
});

test("refreshArticle: 내용 동일하면 null(불필요 커밋 방지)", () => {
  const t = selectTargetRound(FIXTURE, "2026-07-03")!;
  const original = buildArticle(t, FIXTURE, "2026-07-03").markdown;
  // 같은 데이터·같은 날짜면 변화 없음
  assert.equal(refreshArticle(original, t, FIXTURE, "2026-07-03"), null);
});

test("refreshArticle: 마커 없으면 null(사람이 손댄 글 보호)", () => {
  const t = selectTargetRound(FIXTURE, "2026-07-03")!;
  assert.equal(refreshArticle("---\ntitle: 손으로 쓴 글\n---\n\n본문", t, FIXTURE, "2026-07-03"), null);
});
