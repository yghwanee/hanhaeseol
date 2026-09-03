import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStarterKey, getStartersForMatch } from "./lookup";
import type { StartersData } from "@/types/starter";

test("키는 팀 순서와 무관하게 동일", () => {
  assert.equal(
    buildStarterKey("2026-06-02", "롯데", "KIA"),
    buildStarterKey("2026-06-02", "KIA", "롯데"),
  );
});

const DATA: StartersData = {
  lastUpdated: "x",
  starters: {
    [buildStarterKey("2026-06-02", "KIA", "롯데")]: {
      league: "kbo",
      teams: {
        KIA: { name: "네일", era: "3.84", ip: "63⅓", w: 2, l: 4, so: 48, whip: "1.11" },
        "롯데": { name: "나균안", era: "3.45", ip: "57⅓", w: 2, l: 5, so: 48, whip: "1.34" },
      },
    },
  },
};

test("야구 경기 조회 — 홈/원정 매핑", () => {
  const v = getStartersForMatch(DATA, {
    date: "2026-06-02", homeTeam: "롯데", awayTeam: "KIA", sport: "야구",
  });
  assert.ok(v);
  assert.equal(v!.home!.name, "나균안");
  assert.equal(v!.away!.name, "네일");
});

test("야구 아닌 종목은 null", () => {
  const v = getStartersForMatch(DATA, {
    date: "2026-06-02", homeTeam: "토트넘", awayTeam: "아스널", sport: "축구",
  });
  assert.equal(v, null);
});

test("데이터 없는 야구 경기는 home/away 모두 null", () => {
  const v = getStartersForMatch(DATA, {
    date: "2026-06-09", homeTeam: "삼성", awayTeam: "두산", sport: "야구",
  });
  assert.ok(v);
  assert.equal(v!.home, null);
  assert.equal(v!.away, null);
});

test("선발 소스가 없는 야구 리그는 null — 영원히 빈 '선발 미발표' 섹션을 막는다", () => {
  for (const league of ["퓨처스리그", "마이너리그", "고교야구"]) {
    const v = getStartersForMatch(DATA, {
      date: "2026-06-02", homeTeam: "상무", awayTeam: "한화", sport: "야구", league,
    });
    assert.equal(v, null, `${league} 는 선발 섹션을 띄우면 안 된다`);
  }
});

test("KBO·MLB 는 league 를 줘도 그대로 동작", () => {
  const v = getStartersForMatch(DATA, {
    date: "2026-06-02", homeTeam: "롯데", awayTeam: "KIA", sport: "야구", league: "KBO",
  });
  assert.equal(v!.home!.name, "나균안");
});
