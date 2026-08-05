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

/** 편성 데이터에 실제로 경기가 있는 날짜를 쓴다(없으면 폴백 경로만 타서 검증이 약해진다). */
const DATES = ["2026-08-05", "2026-08-06", "2026-08-07", "2026-08-08"];

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

test("아침 제목은 '오늘', 저녁 제목은 '내일'로 시작 프레임이 갈린다", () => {
  for (const d of DATES) {
    const morning = buildShortsTitle("08", d.slice(8, 10), d, "morning");
    const evening = buildShortsTitle("08", d.slice(8, 10), d, "evening");
    assert.ok(morning.includes("오늘"), `${d}: 아침 제목에 '오늘' 없음 — ${morning}`);
    assert.ok(evening.includes("내일"), `${d}: 저녁 제목에 '내일' 없음 — ${evening}`);
  }
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
