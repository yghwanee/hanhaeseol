import { test } from "node:test";
import assert from "node:assert/strict";
import { heroScore, pickHeroMatch, GLOBAL_BIG_CLUBS } from "./hero-pick";
import { getKoreanPlayers } from "./korean-players/load";
import type { Schedule } from "@/types/schedule";

function wc(
  home: string,
  away: string,
  league = "북중미 월드컵",
  time = "21:00",
): Schedule {
  return {
    id: `wc-${home}-${away}`,
    date: "2026-06-12",
    time,
    sport: "축구",
    league,
    homeTeam: home,
    awayTeam: away,
    platform: "JTBC",
    koreanCommentary: true,
  };
}

function club(
  home: string,
  away: string,
  league: string,
  time = "21:00",
): Schedule {
  return {
    id: `club-${home}-${away}`,
    date: "2026-06-12",
    time,
    sport: "축구",
    league,
    homeTeam: home,
    awayTeam: away,
    platform: "SPOTV NOW",
    koreanCommentary: true,
  };
}

test("월드컵 조별경기가 비월드컵 Tier S 빅매치보다 우선", () => {
  const wcGroup = wc("멕시코", "남아프리카 공화국");
  const ucl = club("레알 마드리드", "맨시티", "챔피언스리그");
  assert.equal(pickHeroMatch([ucl, wcGroup]), wcGroup);
});

test("같은 날 16강이 조별리그보다 우선 (라운드 우선)", () => {
  const r16 = wc("우루과이", "스코틀랜드", "북중미 월드컵 16강");
  const group = wc("브라질", "아르헨티나", "북중미 월드컵");
  assert.equal(pickHeroMatch([group, r16]), r16);
});

test("같은 라운드에서 대한민국 경기가 강호 vs 강호보다 우선", () => {
  const korea = wc("대한민국", "체코");
  const bigBig = wc("브라질", "프랑스");
  assert.equal(pickHeroMatch([bigBig, korea]), korea);
});

test("같은 라운드: 양팀 강호 > 한 팀 강호", () => {
  const bigBig = wc("브라질", "프랑스");
  const bigMid = wc("스페인", "파나마");
  assert.equal(pickHeroMatch([bigMid, bigBig]), bigBig);
});

test("같은 라운드·매치업 티어 → 이른 시간 우선", () => {
  const early = wc("브라질", "프랑스", "북중미 월드컵", "18:00");
  const late = wc("스페인", "독일", "북중미 월드컵", "22:00");
  assert.equal(pickHeroMatch([late, early]), early);
});

test("월드컵 없는 날: 기존 heroScore 순위 유지 (회귀 없음)", () => {
  const ucl = club("레알 마드리드", "맨시티", "챔피언스리그", "21:00");
  const kbo: Schedule = {
    id: "kbo-1",
    date: "2026-06-12",
    time: "18:30",
    sport: "야구",
    league: "KBO",
    homeTeam: "키움",
    awayTeam: "NC",
    platform: "SPOTV NOW",
    koreanCommentary: true,
  };
  assert.equal(pickHeroMatch([kbo, ucl]), ucl);
});

// ── 2026-08-05 개편 — 리그가 아니라 팀이 값어치인 경기 ──────────────

test("내한경기 맨시티가 코리안리거 MLB 를 이긴다", () => {
  const manCity = club("팀 K리그", "맨시티", "쿠팡플레이 시리즈", "19:00");
  // 코리안리거 팀도 로스터에서 뽑는다(하드코딩하면 이적 때마다 이 테스트가 거짓말을 한다).
  const korean = getKoreanPlayers()[0];
  assert.ok(korean, "로스터가 비었다 — crawl:korean-players 확인");
  const koreanMatch = club("텍사스 레인저스", korean.team, "MLB", "09:05");
  const hero = pickHeroMatch([koreanMatch, manCity]);
  assert.equal(hero?.awayTeam, "맨시티");
});

test("친선경기여도 글로벌 빅클럽이면 팀 점수를 받는다", () => {
  const friendly = club("첼시", "유벤투스", "클럽 친선경기", "20:30");
  const plain = club("팔레르모", "조호르", "클럽 친선경기", "20:30");
  assert.ok(heroScore(friendly) > heroScore(plain) + 15);
});

test("AT. 마드리드 표기(공백 있음)도 빅클럽으로 잡힌다", () => {
  const spaced = club("맨시티", "AT. 마드리드", "쿠팡플레이 시리즈", "18:30");
  const oneBig = club("맨시티", "팀 K리그", "쿠팡플레이 시리즈", "18:30");
  assert.ok(heroScore(spaced) > heroScore(oneBig));
});

test("코리안리거 가중치는 26 이다", () => {
  // 🔴 팀명을 손으로 박지 않는다. 로스터는 이적으로 바뀌므로(2026-08-23 김하성 탬파베이→
  // 애틀랜타, 김혜성은 마이너行) 박아 두면 테스트가 사람 잘못 없이 빨개진다.
  // 크롤된 로스터에서 "빅클럽이 아닌" 선수를 하나 골라, 그 팀만 바꿔치기해 차이를 잰다.
  const norm = (t: string) => t.replace(/\s+/g, "");
  const player = getKoreanPlayers().find(
    (p) => !p.teams.some((t) => GLOBAL_BIG_CLUBS.has(norm(t))),
  );
  assert.ok(player, "로스터가 비었거나 전원 빅클럽이다 — crawl:korean-players 확인");
  // MLS 는 BIG_TEAMS 에 없는 리그라 팀 점수가 안 섞인다.
  const withKorean = club(player.team, "가상 유나이티드", "MLS", "11:10");
  const withoutKorean = club("가상 시티", "가상 유나이티드", "MLS", "11:10");
  assert.equal(heroScore(withKorean) - heroScore(withoutKorean), 26);
});

test("내한 가점은 글로벌 빅클럽이 낀 쿠팡플레이 시리즈에만 붙는다", () => {
  const withBig = club("팀 K리그", "맨시티", "쿠팡플레이 시리즈", "19:00");
  const withoutBig = club("팀 K리그", "조호르", "쿠팡플레이 시리즈", "19:00");
  // 내한 10 + 한쪽 빅클럽 12 = 22 차이
  assert.equal(heroScore(withBig) - heroScore(withoutBig), 22);
});

test("직전 2일에 나온 팀은 감점을 받는다", () => {
  // 로스터와 무관한 가상 팀으로 잰다 — 실제 팀을 쓰면 이적 한 번에 전제가 깨진다.
  const repeat = club("가상 자이언츠", "가상 애스트로스", "MLB", "10:45");
  const fresh = club("가상 다저스", "가상 로열스", "MLB", "11:10");
  // recentTeams 는 정규화(공백 제거) 표기다.
  const recent = new Set(["가상자이언츠"]);

  // 감점이 없으면 시간이 빠른 쪽(동점)이 이긴다.
  assert.equal(pickHeroMatch([repeat, fresh])?.homeTeam, "가상 자이언츠");
  // 감점이 붙으면 뒤집힌다.
  assert.equal(pickHeroMatch([repeat, fresh], recent)?.homeTeam, "가상 다저스");
});

test("recentTeams 가 비면 감점이 없다", () => {
  const m = club("가상 자이언츠", "가상 애스트로스", "MLB", "10:45");
  assert.equal(heroScore(m, new Set()), heroScore(m));
});
