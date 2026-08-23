import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import raw from "@/data/korean-players.json";
import { NAVER_TO_SCHEDULE_TEAM_NAME } from "@/lib/team-records/team-name-aliases";
import { findKoreanPlayerOnMatch } from "@/lib/hero-pick";
import { getKoreanPlayers, isRosterFresh, ROSTER_MAX_AGE_DAYS } from "./load";
import { MLB_TEAM_ID_TO_SCHEDULE, MLB_KOREAN_NAMES } from "./sources";
import { dedupePlayers } from "./crawl";
import type { KoreanPlayersData } from "./types";

const data = raw as KoreanPlayersData;

test("로스터 데이터 형식", () => {
  assert.ok(Number.isFinite(Date.parse(data.generatedAt)), "generatedAt 이 ISO 시각이어야 한다");
  assert.ok(data.players.length > 0, "선수가 한 명도 없으면 크롤이 죽은 것이다");
  const names = new Set<string>();
  for (const p of data.players) {
    assert.ok(p.name && p.team && p.league, `필드 누락: ${JSON.stringify(p)}`);
    assert.ok(p.teams.length > 0, `${p.name}: teams 비었음`);
    assert.ok(p.teams.includes(p.team), `${p.name}: team 이 teams 에 없음`);
    assert.ok(!names.has(p.name), `${p.name}: 중복 등록`);
    names.add(p.name);
  }
});

// 🔴 이 테스트가 이 사건의 본체다.
// 2026-08-23 이전에는 선수→팀이 hero-pick.ts 에 손으로 박혀 있었고, 이강인이 7월에
// AT 마드리드로 갔는데 코드는 계속 PSG 로 알고 있었다. 그 결과 히어로 선정이 "이강인이
// 뛰지도 않는 PSG 새벽 경기"를 골라 소셜에 내보냈다. 표를 손으로 관리하는 한 반드시 재발한다.
test("선수→팀 매핑을 코드에 하드코딩하지 않는다", () => {
  const files = [
    "src/lib/hero-pick.ts",
    "src/lib/cover-hook.ts",
    "src/lib/hashtags.ts",
    "src/lib/reel-bigmatch-card.ts",
  ];
  // 한국인 이름(2~4자 한글) 바로 뒤에 팀을 적는 리터럴 패턴.
  const hardcoded = /\{\s*name:\s*"[가-힣]{2,4}"\s*,\s*team:/;
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    assert.ok(!hardcoded.test(src), `${f}: 선수→팀을 하드코딩했다. 크롤 데이터를 쓸 것`);
  }
});

test("로스터가 낡으면 선수를 아예 안 쓴다", () => {
  const gen = Date.parse(data.generatedAt);
  const fresh = new Date(gen + 60_000);
  const stale = new Date(gen + (ROSTER_MAX_AGE_DAYS + 1) * 86_400_000);
  assert.ok(getKoreanPlayers(fresh).length > 0, "신선하면 로스터가 있어야 한다");
  assert.equal(getKoreanPlayers(stale).length, 0, "낡으면 빈 배열이어야 한다");
  assert.equal(isRosterFresh(stale), false);
  // 크롤 시각보다 과거를 넘기면(시계 역행) 신선하다고 보지 않는다.
  assert.equal(isRosterFresh(new Date(gen - 86_400_000)), false);
});

test("팀 표기 흔들림을 흡수한다", () => {
  const gen = new Date(Date.parse(data.generatedAt) + 60_000);
  const lee = data.players.find((p) => p.name === "이강인");
  if (!lee) return; // 이적으로 라리가를 떠나면 이 단언은 의미가 없다
  // 편성은 "AT. 마드리드"(점+공백), 네이버 별칭은 "AT.마드리드" 로 갈린다.
  assert.equal(findKoreanPlayerOnMatch("AT. 마드리드", "비야레알", gen)?.name, "이강인");
  assert.equal(findKoreanPlayerOnMatch("비야레알", "AT.마드리드", gen)?.name, "이강인");
  assert.equal(findKoreanPlayerOnMatch("PSG", "스타드 렌", gen), null);
});

test("MLB 팀 표기가 편성 별칭표와 일치한다", () => {
  const known = new Set(
    Object.values(NAVER_TO_SCHEDULE_TEAM_NAME.MLB ?? {}).flatMap((v) =>
      Array.isArray(v) ? v : [v],
    ),
  );
  assert.equal(Object.keys(MLB_TEAM_ID_TO_SCHEDULE).length, 30, "MLB 는 30팀이다");
  for (const [id, name] of Object.entries(MLB_TEAM_ID_TO_SCHEDULE)) {
    assert.ok(known.has(name), `MLB ${id}: "${name}" 이 편성 표기와 다르다`);
  }
  // 이름표는 허용 목록도 겸한다 — 한국 태생 미국 선수를 코리안리거로 잡지 않기 위함.
  assert.ok(Object.keys(MLB_KOREAN_NAMES).length > 0);
  assert.ok(!("Rob Refsnyder" in MLB_KOREAN_NAMES));
});

test("같은 선수가 리그+컵대회에 중복으로 잡히면 팀 표기만 합친다", () => {
  const merged = dedupePlayers([
    { name: "이강인", team: "AT.마드리드", teams: ["AT.마드리드"], league: "라리가", source: "naver" },
    {
      name: "이강인",
      team: "아틀레티코 마드리드",
      teams: ["아틀레티코 마드리드"],
      league: "챔피언스리그",
      source: "naver",
    },
  ]);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].teams.sort(), ["AT.마드리드", "아틀레티코 마드리드"].sort());
  assert.equal(merged[0].league, "라리가");
});
