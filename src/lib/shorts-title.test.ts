// 아침/저녁 중복 업로드 방지 가드.
//
// 2026-08-04 저녁 쇼츠부터 Shorts 피드 배포가 끊겼다(피드 조회 3, 직전 정상분 400+).
// 원인 후보 중 코드로 막을 수 있는 것 = 저녁(내일 경기)과 다음날 아침(오늘 경기)이
// 같은 날짜를 대상으로 삼아 제목·설명이 글자까지 같아지던 것. 그 상태로 되돌아가면
// 이 테스트가 깨진다.

import test from "node:test";
import assert from "node:assert/strict";
import {
  TITLE_MAX,
  buildHookLine,
  buildShortsTitle,
  MORNING_HOOKS,
  EVENING_HOOKS,
} from "./shorts-title";
import { rotateIndex } from "./post-slot";
import { inferDayLabel } from "./instagram";

/**
 * 편성 데이터에 실제로 경기가 있는 날짜를 쓴다(없으면 폴백 경로만 타서 검증이 약해진다).
 * 🔴 날짜를 하드코딩하면 안 된다 — schedule.json 은 오늘부터 7일치라, 박아 둔 날짜가
 * 과거가 되는 순간 조용히 폴백만 검사하게 된다(2026-08-07 에 실제로 그 상태였다).
 */
const DATES = Array.from({ length: 4 }, (_, i) => kstDatePlus(i));

function kstDatePlus(days: number): string {
  const kst = new Date(Date.now() + 9 * 3600_000 + days * 86400_000);
  return kst.toISOString().slice(0, 10);
}

test("제목 풀은 슬롯당 8개다", () => {
  // 4개면 같은 틀이 나흘마다 돌아온다.
  // 생성 결과로는 셀 수 없다 — 팀명·시각이 매일 달라 풀이 4개여도 문자열은 다 다르게 나온다.
  assert.equal(MORNING_HOOKS.length, 8);
  assert.equal(EVENING_HOOKS.length, 8);
});

test("같은 날짜라도 아침·저녁 제목이 다르다", () => {
  for (const d of DATES) {
    const morning = buildShortsTitle("08", d.slice(8, 10), d, "morning");
    const evening = buildShortsTitle("08", d.slice(8, 10), d, "evening");
    assert.notEqual(morning, evening, `${d}: 아침·저녁 제목이 같음 — ${morning}`);
  }
});

test("🔴 제목의 '오늘/내일'은 슬롯이 아니라 **게시 시점**을 따른다", () => {
  // 종전에는 아침 풀에 "오늘", 저녁 풀에 "내일"이 박혀 있었다.
  // cron 이 12시간 밀려 저녁분이 KST 04:27 에 나가자, 그날 밤 경기를
  // "내일"이라 부르며 업로드됐다(2026-08-29 실측).
  //   `내일 밤 10시 30분 이재성 ⚽ 한국어 중계 채널 정리 8/29(토) #Shorts`
  // 세트 정의(아침=오늘치 / 저녁=내일치)는 그대로 두되, 부르는 말은 실제 시각을 따른다.
  for (const d of DATES) {
    for (const slot of ["morning", "evening"] as const) {
      const now = new Date();
      const t = buildShortsTitle("08", d.slice(8, 10), d, slot, now);
      const expected = inferDayLabel(d, now);
      const wrong = expected === "오늘" ? "내일" : "오늘";
      assert.ok(!t.includes(wrong), `${d}/${slot}: '${wrong}'이라 부른다(정답 '${expected}') — ${t}`);
    }
  }
});

test("정상 운영(저녁=내일치)에서는 저녁 제목이 '내일'로 나간다", () => {
  // KST 18:00 에 다음 날짜를 대상으로 도는, 지연 없는 저녁 실행.
  const now = new Date(Date.UTC(2026, 7, 28, 9, 0)); // KST 2026-08-28 18:00
  const target = "2026-08-29";
  assert.equal(inferDayLabel(target, now), "내일");
  const t = buildShortsTitle("08", "29", target, "evening", now);
  assert.ok(t.includes("내일"), `정상 저녁인데 '내일'이 없다 — ${t}`);
});

test("제목은 유튜브 상한(100자) 이내이고 날짜·#Shorts를 유지한다", () => {
  for (const d of DATES) {
    for (const slot of ["morning", "evening"] as const) {
      const t = buildShortsTitle("08", d.slice(8, 10), d, slot);
      assert.ok(t.length <= TITLE_MAX, `${d}/${slot}: ${t.length}자 — ${t}`);
      assert.ok(t.endsWith("#Shorts"), `${d}/${slot}: #Shorts 누락 — ${t}`);
      assert.match(t, /\d+\/\d+\([월화수목금토일]\)/, `${d}/${slot}: 날짜 표기 누락 — ${t}`);
      assert.ok(
        t.includes("한국어") || t.includes("중계") || t.includes("해설"),
        `${d}/${slot}: 검색 키워드가 통째로 빠짐 — ${t}`,
      );
    }
  }
});

test("🔴 모든 후킹 문구가 검색 키워드 '한국어'+'중계/해설'을 갖는다", () => {
  // 종전 가드는 DATES 를 돌며 **그날 회전이 집은 문구만** 검사해서, 풀 안에 키워드 없는
  // 문구가 섞여 있어도 회전이 그 칸에 닿는 날에만 빨개졌다. 실제로 2026-08-10 실행에서
  // `EVENING_HOOKS[6]`(`내일 볼 거 미리 찍어두세요 ⚾ 김혜성 낮 11시 10분`)과
  // `MORNING_HOOKS[3]`(`… 오늘 중계 … 채널 하나로 정리했습니다`) 두 개가 이 상태였다.
  // 쇼츠는 제목이 검색 대상이라 키워드가 빠진 날은 그 업로드 하나가 통째로 검색에서 샌다.
  // 풀 전체를 직접 훑어 날짜와 무관하게 잡는다.
  const ctx = {
    who: "김혜성",
    isPlayer: true,
    time: "낮 11시 10분",
    games: 4,
    emoji: "⚾",
    dayWord: "내일" as const,
  };
  for (const [name, pool] of [
    ["MORNING", MORNING_HOOKS],
    ["EVENING", EVENING_HOOKS],
  ] as const) {
    pool.forEach((fn, i) => {
      const s = fn(ctx);
      assert.ok(s.includes("한국어"), `${name}_HOOKS[${i}] 에 '한국어' 없음 — ${s}`);
      assert.ok(/중계|해설/.test(s), `${name}_HOOKS[${i}] 에 '중계/해설' 없음 — ${s}`);
    });
  }
});

test("제목 문구가 날짜마다 고정되지 않는다(박제 방지)", () => {
  const titles = new Set(
    DATES.map((d) => buildShortsTitle("08", d.slice(8, 10), d, "evening")),
  );
  assert.ok(titles.size >= 2, `저녁 제목이 날짜와 무관하게 한 종류뿐: ${[...titles]}`);
});

test("설명 첫 줄 후킹도 아침·저녁이 다르다", () => {
  for (const d of DATES) {
    assert.notEqual(
      buildHookLine(d, "morning"),
      buildHookLine(d, "evening"),
      `${d}: 후킹 문장이 같음`,
    );
  }
});

test("후킹 문장은 제목과 같은 문장을 재사용하지 않는다", () => {
  for (const d of DATES) {
    for (const slot of ["morning", "evening"] as const) {
      const title = buildShortsTitle("08", d.slice(8, 10), d, slot);
      const hook = buildHookLine(d, slot);
      assert.ok(!title.startsWith(hook), `${d}/${slot}: 제목·설명 첫 줄이 동일 문장 — ${hook}`);
    }
  }
});

// 2026-08-07: 슬롯만 갈라 놨더니 같은 실행 안에서 캐러셀·릴스 캡션이 글자까지 같았다
// (실측 `[REELS] 오늘 KIA 경기 …` = `[FEED] 오늘 KIA 경기 …`). 한 번의 게시로 나가는
// 네 텍스트(제목·유튜브 설명·캐러셀·릴스)가 전부 달라야 한다.
test("같은 실행에서 나가는 후킹 문장이 게시면별로 모두 다르다", () => {
  for (const d of DATES) {
    for (const slot of ["morning", "evening"] as const) {
      const title = buildShortsTitle("08", d.slice(8, 10), d, slot);
      const lines = [
        buildHookLine(d, slot, "youtube-desc"),
        buildHookLine(d, slot, "ig-feed"),
        buildHookLine(d, slot, "ig-reel"),
      ];
      assert.equal(
        new Set(lines).size,
        lines.length,
        `${d}/${slot}: 게시면 후킹이 겹침 — ${JSON.stringify(lines)}`,
      );
      for (const line of lines) {
        assert.ok(!title.startsWith(line), `${d}/${slot}: 제목과 겹침 — ${line}`);
      }
    }
  }
});

test("rotateIndex는 결정적이고 풀 범위를 벗어나지 않는다", () => {
  for (const d of DATES) {
    for (const size of [1, 3, 4, 5]) {
      const a = rotateIndex(d, "morning", size);
      const b = rotateIndex(d, "morning", size);
      assert.equal(a, b);
      assert.ok(a >= 0 && a < size);
    }
  }
});
