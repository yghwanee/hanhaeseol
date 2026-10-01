import { test } from "node:test";
import assert from "node:assert/strict";
import {
  heroScore,
  pickHeroMatch,
  isTopPriority,
  isNationalTeamMatch,
  nationalOpponent,
  GLOBAL_BIG_CLUBS,
} from "./hero-pick";
import { nationalEventFor } from "./national-event";
import { loadKoreanMatchesAll, pickHeroForDate, getKstToday } from "./instagram";
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

// ─────────────────────────────────────────────────────────────────────────────
// 최우선 클럽 (2026-08-29, 운영자 지정)
//   "이제는 프리미어리그가 더 보고 싶다. 맨유·맨시티·첼시·리버풀·아스날은 1순위."
// 점수가 아니라 티어다 — 가중치로 표현하려 하면 다른 날 선정이 통째로 흔들린다.
// ─────────────────────────────────────────────────────────────────────────────

/** 코리안리거가 뛰는 프라임타임 MLB — 종전 체계에서 가장 강한 후보. */
function koreanPrime(time = "20:00"): Schedule {
  const players = getKoreanPlayers();
  const team = players.find((p) => p.teams.length > 0)?.teams[0];
  return {
    id: "mlb-korean",
    date: "2026-08-30",
    time,
    sport: "야구",
    league: "MLB",
    homeTeam: team ?? "샌프란시스코 자이언츠",
    awayTeam: "애리조나 다이아몬드백스",
    platform: "SPOTV NOW",
    koreanCommentary: true,
  };
}

test("🔴 최우선 클럽은 코리안리거 프라임타임 경기보다 앞선다", () => {
  const rival = koreanPrime("20:00");
  for (const name of ["맨유", "맨시티", "첼시", "리버풀", "아스날"]) {
    // 최악 조건을 준다 — 새벽 경기 + 약체 상대 + 이벤트성 대회.
    const epl = club("아스톤 빌라", name, "프리미어리그", "04:00");
    const hero = pickHeroMatch([rival, epl]);
    assert.equal(
      hero?.id,
      epl.id,
      `${name} 새벽 경기가 코리안리거 프라임타임에 밀렸다 (score ${heroScore(epl)} vs ${heroScore(rival)})`,
    );
  }
});

test("최우선 클럽끼리는 heroScore 로 갈린다 — 프라임타임이 이긴다", () => {
  const dawn = club("크리스탈 팰리스", "맨시티", "프리미어리그", "04:00");
  const prime = club("리버풀", "노팅엄", "프리미어리그", "20:30");
  assert.equal(pickHeroMatch([dawn, prime])?.id, prime.id);
});

test("지목되지 않은 팀(토트넘·뉴캐슬)은 티어를 받지 않는다", () => {
  // 티어가 아니어도 기존 점수 체계에서는 강하다 — 그래서 '티어가 없다'만 확인한다.
  const spurs = club("토트넘", "뉴캐슬", "프리미어리그", "04:00");
  assert.equal(isTopPriority(spurs), false);
  assert.equal(isTopPriority(club("아스톤 빌라", "아스날", "프리미어리그")), true);
});

test("대회를 가리지 않는다 — 컵·친선에서도 최우선", () => {
  for (const league of ["카라바오컵", "챔피언스리그", "클럽 친선경기", "쿠팡플레이 시리즈"]) {
    assert.equal(isTopPriority(club("팀 K리그", "맨시티", league)), true, league);
  }
});

test("🔴 실데이터 — 최우선 클럽 경기가 있는 날은 히어로가 그 중 하나다", (t) => {
  // 날짜를 박지 않는다. schedule.json 은 오늘부터 7일치라, 박아 두면 지나가는 순간
  // 조용히 아무것도 검사하지 않게 된다(작업84 에서 실제로 겪었다).
  const base = getKstToday(0).today;
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${base}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  let checked = 0;
  for (const d of days) {
    const matches = loadKoreanMatchesAll(d);
    const top = matches.filter(isTopPriority);
    if (top.length === 0) continue;
    // 대표팀 경기가 있는 날은 그쪽이 앞선다(2026-10-02) — 아래 별도 테스트가 본다.
    if (matches.some(isNationalTeamMatch)) continue;
    checked++;
    const hero = pickHeroForDate(d);
    assert.ok(
      hero && isTopPriority(hero),
      `${d}: 최우선 클럽 경기가 ${top.length}개인데 히어로는 ` +
        `${hero?.league} ${hero?.homeTeam} vs ${hero?.awayTeam} 였다`,
    );
  }
  // 🔴 비었으면 실패가 아니라 **건너뜀**으로 남긴다. 2026-10-01 A매치 기간(편성 축구가
  // 네이션스리그·대표팀뿐)에 이 줄이 CI 를 빨갛게 만들었다 — 클럽 경기가 없는 주는 해마다 온다.
  // 조용히 통과시키지 않고 skip 으로 찍어, 검사가 비었다는 사실은 로그에 남긴다.
  if (checked === 0) t.skip("7일 안에 최우선 클럽 경기가 없다(A매치 기간·비시즌)");
});

// ─────────────────────────────────────────────────────────────────────────────
// 국가대표 티어 (2026-10-02)
//   10/03 아시안게임 남자축구 금메달전 한일전이 후보 5위 안에도 못 들고 히어로가
//   `KIA 13:40` 이었다. A매치 베네수엘라전은 송성문 MLB 에, 우즈베키스탄전은 SSG 에 밀렸다.
// ─────────────────────────────────────────────────────────────────────────────

function national(home: string, away: string, league: string, time = "19:30"): Schedule {
  return {
    id: `nat-${home}-${away}`,
    date: "2026-10-03",
    time,
    sport: "축구",
    league,
    homeTeam: home,
    awayTeam: away,
    platform: "SPOTV NOW",
    koreanCommentary: true,
  };
}

test("🔴 대표팀 경기는 코리안리거 프라임타임 경기보다 앞선다", () => {
  const rival = koreanPrime("20:00");
  // 최악 조건 — 새벽 경기 + 등급표에 없는 대회명.
  const korea = national("베네수엘라", "대한민국", "남자축구 국가대표팀", "04:00");
  assert.equal(pickHeroMatch([rival, korea])?.id, korea.id);
});

test("🔴 대표팀 경기는 최우선 클럽보다도 앞선다", () => {
  const epl = club("리버풀", "아스날", "프리미어리그", "20:30");
  const korea = national("대한민국", "일본", "아이치-나고야 아시안게임");
  assert.equal(pickHeroMatch([epl, korea])?.id, korea.id);
});

test("대표팀 경기끼리는 heroScore(시간대)로 갈린다", () => {
  const afternoon = national("중국", "대한민국", "아이치-나고야 아시안게임", "15:00");
  const evening = national("대한민국", "베네수엘라", "남자축구 국가대표팀", "19:30");
  assert.equal(pickHeroMatch([afternoon, evening])?.id, evening.id);
});

test("다른 나라끼리의 대표팀 경기는 티어를 받지 않는다", () => {
  assert.equal(isNationalTeamMatch(national("북한", "일본", "아이치-나고야 아시안게임")), false);
  assert.equal(isNationalTeamMatch(national("대한민국 U23", "일본", "친선")), true);
});

test("월드컵 정렬은 그대로다 — 대표팀 티어가 라운드 우선을 뒤집지 않는다", () => {
  const r16 = wc("우루과이", "스코틀랜드", "북중미 월드컵 16강");
  const koreaGroup = wc("대한민국", "체코", "북중미 월드컵");
  assert.equal(pickHeroMatch([koreaGroup, r16]), r16);
});

test("상대 팀을 홈·원정 어느 쪽에서도 찾는다", () => {
  assert.equal(nationalOpponent(national("대한민국", "일본", "x")), "일본");
  assert.equal(nationalOpponent(national("중국", "대한민국", "x")), "중국");
  assert.equal(nationalOpponent(national("대한민국", "미정", "x")), null);
  assert.equal(nationalOpponent(club("리버풀", "아스날", "프리미어리그")), null);
});

test("대회 라벨 — A매치·한일전·아시안게임", () => {
  const amatch = nationalEventFor(national("대한민국", "베네수엘라", "남자축구 국가대표팀"));
  assert.equal(amatch?.event, "축구 A매치");
  assert.equal(amatch?.matchup, "대한민국 vs 베네수엘라");
  assert.equal(amatch?.nickname, null);

  // 종목 파일에 없는 가상 경기 → 라운드를 지어내지 않고 종목명만 붙인다.
  const ag = nationalEventFor({
    ...national("대한민국", "일본", "아이치-나고야 아시안게임", "23:59"),
    date: "2099-01-01",
  });
  assert.equal(ag?.event, "아시안게임 축구 한일전");
  assert.equal(ag?.eventTag, "아시안게임");
  assert.equal(ag?.nickname, "한일전");

  assert.equal(nationalEventFor(club("리버풀", "아스날", "프리미어리그")), null);
});

test("🔴 실데이터 — 대표팀 경기가 있는 날은 히어로가 그 경기다", (t) => {
  const base = getKstToday(0).today;
  let checked = 0;
  for (let i = 0; i < 7; i++) {
    const dt = new Date(`${base}T00:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() + i);
    const d = dt.toISOString().slice(0, 10);
    const nat = loadKoreanMatchesAll(d).filter(isNationalTeamMatch);
    if (nat.length === 0) continue;
    checked++;
    const hero = pickHeroForDate(d);
    assert.ok(
      hero && isNationalTeamMatch(hero),
      `${d}: 대표팀 경기가 ${nat.length}개인데 히어로는 ${hero?.league} ${hero?.homeTeam} vs ${hero?.awayTeam}`,
    );
  }
  if (checked === 0) t.skip("7일 안에 대표팀 경기가 없다");
});
