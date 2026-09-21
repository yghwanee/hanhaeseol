import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import {
  agPhase,
  broadcastKey,
  crawlDates,
  daysToOpen,
  medalsStarted,
  rankMedals,
  toAgGame,
  AG_CLOSE,
  AG_FIRST_GAME,
  AG_OPEN,
  type AsianGamesData,
} from "@/lib/asian-games/data";

/**
 * 아시안게임 허브 가드.
 *
 * 1. 순위: 네이버 rankOrder 는 메달 0개일 때 전부 1 이다 — 우리가 금·은·동으로 다시 매긴다.
 * 2. 예정 경기 0:0 을 스코어로 보여 주지 않는다.
 * 3. 크롤 날짜가 대회 기간 밖으로 새지 않는다(빈 요청 · 옛 날짜 커밋 방지).
 * 4. 커밋된 데이터 파일이 페이지를 깨뜨리지 않는 모양인지.
 */

const row = (countryName: string, gold: number, silver: number, bronze: number) => ({
  countryId: countryName,
  countryName,
  gold,
  silver,
  bronze,
  total: gold + silver + bronze,
});

test("금 → 은 → 동 순서로 매기고 완전히 같으면 공동 순위", () => {
  const r = rankMedals([row("일본", 3, 1, 0), row("대한민국", 3, 2, 0), row("중국", 5, 0, 0), row("태국", 3, 1, 0)]);
  assert.deepEqual(
    r.map((x) => `${x.rank}:${x.countryName}`),
    ["1:중국", "2:대한민국", "3:일본", "3:태국"],
  );
});

test("메달 0개면 순위표 대신 안내를 쓴다", () => {
  assert.equal(medalsStarted(rankMedals([row("가", 0, 0, 0), row("나", 0, 0, 0)])), false);
  assert.equal(medalsStarted(rankMedals([row("가", 0, 0, 1)])), true);
});

test("예정 경기와 개인 종목은 점수를 null 로 둔다", () => {
  const before = toAgGame({ gameDateTime: "2026-09-17T16:00:00", homeTeamName: "방글라데시", awayTeamName: "대한민국", homeTeamScore: 0, awayTeamScore: 0, statusCode: "BEFORE" });
  assert.equal(before.homeScore, null);
  assert.equal(before.time, "16:00");
  const live = toAgGame({ gameDateTime: "2026-09-17T16:00:00", homeTeamName: "방글라데시", awayTeamName: "대한민국", homeTeamScore: 0, awayTeamScore: 2, statusCode: "STARTED" });
  assert.equal(live.awayScore, 2);
  const solo = toAgGame({ gameDateTime: "2026-09-20T08:45:00", homeTeamName: "", awayTeamName: "", homeTeamScore: 0, statusCode: "RESULT" });
  assert.equal(solo.homeScore, null);
});

test("중계 매칭 키는 홈/원정 순서와 공백에 흔들리지 않는다", () => {
  assert.equal(broadcastKey("2026-09-17", "방글라데시", "대한민국"), broadcastKey("2026-09-17", "대한민국 ", "방글라데시"));
  assert.notEqual(broadcastKey("2026-09-17", "대한민국", "홍콩"), broadcastKey("2026-09-18", "대한민국", "홍콩"));
});

test("대회 국면과 크롤 날짜가 대회 기간 밖으로 새지 않는다", () => {
  assert.equal(agPhase("2026-09-01"), "before");
  assert.equal(agPhase(AG_FIRST_GAME), "prelim");
  assert.equal(agPhase(AG_OPEN), "live");
  assert.equal(agPhase(AG_CLOSE), "live");
  assert.equal(agPhase("2026-10-06"), "over");
  assert.equal(daysToOpen(AG_OPEN), 0);
  // 대회 전 기간을 빠짐없이, 기간 밖은 하나도 없이.
  const dates = crawlDates();
  assert.equal(dates[0], AG_FIRST_GAME);
  assert.equal(dates.at(-1), AG_CLOSE);
  assert.equal(dates.length, 25);
  assert.equal(new Set(dates).size, dates.length);
});

test("커밋된 데이터 파일 모양", () => {
  const file = path.join(process.cwd(), "public", "asian-games.json");
  if (!fs.existsSync(file)) return; // 첫 크롤 전
  const data = JSON.parse(fs.readFileSync(file, "utf-8")) as AsianGamesData;
  assert.ok(data.medals.length >= 30, `참가국이 너무 적다: ${data.medals.length}`);
  for (const m of data.medals) {
    assert.equal(m.total, m.gold + m.silver + m.bronze, `${m.countryName} 합계 불일치`);
    assert.ok(m.rank >= 1);
  }
  // 파일이 커지면 GitHub raw 로 받는 방문자 부담이 커진다. 한국 경기만 담으니 넉넉한 상한.
  assert.ok(fs.statSync(file).size < 200_000, "asian-games.json 이 200KB 를 넘었다");
});

// ───────── 종목별 페이지 (2026-09-21) ─────────
import {
  AG_SPORTS,
  agSportsFile,
  gamesForRender,
  isKoreaGame,
  RENDER_LIMIT,
  groupEsports,
  groupStandingsTable,
  isAgScheduleLeague,
  koreaRecord,
  type AgGame,
} from "@/lib/asian-games/data";

const game = (p: Partial<AgGame>): AgGame => ({
  id: Math.random().toString(36),
  date: "2026-09-22",
  time: "19:00",
  discipline: "축구",
  title: "",
  home: "",
  away: "",
  homeScore: null,
  awayScore: null,
  status: "BEFORE",
  statusInfo: "예정",
  medal: false,
  ...p,
});

test("편성 리그명은 하이픈·가운뎃점 어느 쪽이든 아시안게임으로 잡는다", () => {
  // 🔴 SPOTV NOW 실제 표기는 하이픈이었다. 가운뎃점 상수와 === 비교라 허브 중계 뱃지가 0개였다.
  assert.equal(isAgScheduleLeague("아이치-나고야 아시안게임"), true);
  assert.equal(isAgScheduleLeague("아이치·나고야 아시안게임"), true);
  assert.equal(isAgScheduleLeague("KBO"), false);
});

test("편성 ↔ 네이버 국가명 차이를 흡수한다", () => {
  assert.equal(broadcastKey("2026-09-22", "대한민국", "사우디아라비아"), broadcastKey("2026-09-22", "사우디 아라비아", "대한민국"));
  assert.equal(broadcastKey("2026-09-21", "대만", "대한민국"), broadcastKey("2026-09-21", "대한민국", "차이니스 타이베이"));
});

test("e스포츠는 롤이 맨 앞이고, 제목에 게임명이 없는 그란투리스모 예선도 제자리를 찾는다", () => {
  const gs = [
    game({ discipline: "e스포츠", title: "타임어택 예선 매치 1", event: "ESPOGT7" }),
    game({ discipline: "e스포츠", title: "그란투리스모7 그랜드 파이널 스테이지", event: "ESPOGT7" }),
    game({ discipline: "e스포츠", title: "e풋볼 8강 1경기", event: "ESPOEFB" }),
    game({ discipline: "e스포츠", title: "리그 오브 레전드 A조 1경기", event: "ESPOLOL" }),
  ];
  const g = groupEsports(gs);
  assert.equal(g[0].name, "리그 오브 레전드(롤)");
  assert.equal(g.find((x) => x.name.startsWith("그란투리스모"))?.games.length, 2);
  assert.equal(g.some((x) => x.name === "기타"), false);
});

test("조편성은 제목의 조에서만 모으고 한국을 맨 앞에 둔다", () => {
  const t = groupStandingsTable([
    game({ title: "남자 D조 1경기", home: "카타르", away: "대한민국" }),
    game({ title: "남자 D조 2경기", home: "카타르", away: "사우디 아라비아" }),
    game({ title: "남자 8강 1경기", home: "일본", away: "이란" }),
  ]);
  assert.deepEqual(t, [{ label: "남자 D조", teams: ["대한민국", "사우디 아라비아", "카타르"] }]);
});

test("한국 전적은 끝난 경기만, 성별을 갈라 센다", () => {
  const r = koreaRecord([
    game({ title: "남자 D조 1경기", home: "카타르", away: "대한민국", homeScore: 1, awayScore: 4, status: "RESULT" }),
    game({ title: "여자 F조 1경기", home: "대한민국", away: "미얀마", homeScore: 0, awayScore: 0, status: "RESULT" }),
    game({ title: "남자 D조 3경기", home: "대한민국", away: "사우디 아라비아" }),
  ]);
  assert.deepEqual(r, [
    { gender: "남자", win: 1, draw: 0, lose: 0 },
    { gender: "여자", win: 0, draw: 1, lose: 0 },
  ]);
});

test("종목마다 파일이 있고 그 종목 경기만 들어 있다", () => {
  for (const s of AG_SPORTS) {
    const p = path.join(process.cwd(), "public", agSportsFile(s.slug));
    const d = JSON.parse(fs.readFileSync(p, "utf-8")) as { games: AgGame[] };
    assert.ok(d.games.length > 0, `${s.slug} 경기가 비었다`);
    // 🔴 한 파일에 12종목을 담으면 409KB 였다. 파일이 섞이면 그 사고로 되돌아간다.
    const wrong = d.games.find((g) => !s.disciplines.includes(g.discipline));
    assert.equal(wrong, undefined, `${s.slug} 파일에 다른 종목(${wrong?.discipline})이 섞였다`);
  }
});

test("렌더 대상은 상한을 넘지 않고, 한국 경기와 메달 경기는 안 잘린다", () => {
  const many: AgGame[] = [];
  for (let i = 0; i < 400; i++) {
    const d = `2026-09-${String(10 + (i % 20)).padStart(2, "0")}`;
    many.push(game({ date: d, title: `예선 ${i}`, home: "일본", away: "중국" }));
  }
  many.push(game({ date: "2026-10-03", title: "결승", home: "대한민국", away: "일본", medal: true }));
  const out = gamesForRender(many, "2026-09-21");
  assert.ok(out.length <= RENDER_LIMIT, `${out.length}건`);
  assert.ok(out.some((g) => isKoreaGame(g) && g.medal), "한국 메달 경기가 잘렸다");
  // 상한 아래면 손대지 않는다.
  assert.equal(gamesForRender(many.slice(0, 10), "2026-09-21").length, 10);
});

// ───────── 롤 전용 페이지 (2026-09-21) ─────────
import { koreanPlayersOf, LOL_EVENT, LOL_KOREA_ROSTER, LOL_ROSTER_ANNOUNCED } from "@/lib/asian-games/data";

test("롤 페이지: 명단에 페이커가 있고, e스포츠 파일에 롤 경기가 있다", () => {
  // 🔴 `아시안게임 페이커` 검색은 이름이 페이지에 있어야 후보가 된다. 명단이 비거나
  // 이름이 빠지면 그 착지점이 통째로 사라진다.
  assert.equal(LOL_KOREA_ROSTER.length, 6);
  assert.ok(LOL_KOREA_ROSTER.some((p) => p.nick === "페이커" && p.name === "이상혁"));
  assert.match(LOL_ROSTER_ANNOUNCED, /^\d{4}-\d{2}-\d{2}$/);
  const d = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", agSportsFile("esports")), "utf-8")) as { games: AgGame[] };
  const lol = d.games.filter((g) => g.event === LOL_EVENT);
  assert.ok(lol.length > 0, "e스포츠 파일에 롤 경기가 없다 — eventId 가 바뀌었나?");
  assert.ok(lol.some((g) => g.medal && g.title.includes("금메달")), "롤 금메달전이 없다");
});

test("한국 선수 이름을 네이버 koreanPlayers 에서 받고, 이름만 있어도 한국 경기로 본다", () => {
  // 🔴 선수 이름 검색(`김도영 아시안게임` 8,920/월)의 착지 조건. 손으로 적지 않는다.
  const g = toAgGame({
    gameId: "x", gameDate: "2026-09-25", gameDateTime: "2026-09-25T10:00:00", title: "남자 개인 64강",
    disciplineName: "양궁 리커브", statusCode: "BEFORE",
    koreanPlayers: [{ name: "김우진" }, { name: "김우진" }, { name: " 이우석 " }],
  });
  assert.deepEqual(g.players, ["김우진", "이우석"]);
  assert.equal(isKoreaGame(g), true);
  assert.equal(toAgGame({ gameId: "y", title: "x", disciplineName: "양궁 리커브" }).players, undefined);
  assert.deepEqual(koreanPlayersOf([g, { ...g, players: ["강채영"] }]), ["강채영", "김우진", "이우석"]);
});
