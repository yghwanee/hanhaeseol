import { test } from "node:test";
import assert from "node:assert/strict";
import { lintGuide, paragraphs, stripFrontmatter } from "./style-lint";

const FM = `---
title: 테스트 글
description: 설명
date: 2026-07-20
updated: 2026-07-20
category: 해외축구
---

`;

function rules(md: string): string[] {
  return lintGuide(md).map((f) => f.rule);
}

test("stripFrontmatter / paragraphs: 표와 소제목은 산문에서 뺀다", () => {
  const md = `${FM}첫 문단이에요.

### 소제목

| 항목 | 내용 |
|---|---|
| 요금 | 12,400원 |

둘째 문단이에요.`;
  assert.ok(!stripFrontmatter(md).includes("title: 테스트"));
  const ps = paragraphs(stripFrontmatter(md));
  assert.equal(ps.length, 2);
  assert.ok(!ps.join(" ").includes("|"));
});

test("줄표와 굽은 따옴표를 잡는다", () => {
  const found = rules(`${FM}이강인 이적 — 확정입니다. 그가 “간다”고 했어요.`);
  assert.ok(found.includes("dash"));
  assert.ok(found.includes("curly-quote"));
});

test("소제목 이모지와 라벨형 소제목을 잡는다", () => {
  const md = `${FM}본문 시작입니다.

### ⚽ 중계 정보

내용이에요.

### 시청 조건

내용이에요.`;
  const found = rules(md);
  assert.ok(found.includes("emoji-heading"));
  // "시청 조건"·"중계 정보" 둘 다 라벨이라 두 번 잡혀야 한다
  assert.equal(found.filter((r) => r === "label-heading").length, 2);
});

test("정형 오프너와 정형 클로저를 잡는다", () => {
  const md = `${FM}2026-27 라리가 중계를 정리해봤습니다.

가운데 문단이에요.

한해설에서 편성표를 확인하세요.`;
  const found = rules(md);
  assert.ok(found.includes("formulaic-opener"));
  assert.ok(found.includes("formulaic-closer"));
});

test("주어 없는 감정 표현을 잡는다", () => {
  // 실제 발행글(lee-kang-in-atletico-laliga-broadcast)에서 나온 문장
  const found = rules(`${FM}아틀레티코 유니폼을 입고 붙는 경기라 꽤 기대되는 게 사실이에요.`);
  assert.ok(found.includes("subjectless-emotion"));
});

test("표가 두 개 이상이면 잡는다", () => {
  const md = `${FM}본문이에요.

| 항목 | 내용 |
|---|---|
| 요금 | 12,400원 |

가운데 문단.

| 팀 | 일정 |
|---|---|
| 말라가 | 8월 16일 |
`;
  assert.ok(rules(md).includes("too-many-tables"));
});

test("깨끗한 글은 오류가 없다", () => {
  const md = `${FM}PSG 시절엔 리그1을 볼 데가 없었다. 그래서 이강인 경기는 UCL 아니면 못 봤다.

이번엔 쿠팡플레이가 라리가를 독점한다. 스포츠패스를 끊어야 하고, 와우회원이면 월 12,400원이다. 나는 EPL 때문에 이미 결제하고 있어서 추가 비용은 없었다. 이강인 하나 보려고 새로 끊는 거라면 좀 아깝다고 느낄 사람도 있겠다.

개막은 8월 16일. 상대는 승격팀 말라가다.`;
  const errors = lintGuide(md).filter((f) => f.severity === "error");
  assert.deepEqual(errors, []);
});

test("문단 길이가 고르면 경고한다", () => {
  const p = "이건 대략 같은 길이를 가진 문단입니다. 문장을 두 개 정도 넣어둡니다.";
  const md = `${FM}${p}\n\n${p}\n\n${p}\n\n${p}`;
  assert.ok(rules(md).includes("even-paragraphs"));
});

test("종결어미가 죄다 같으면 경고한다", () => {
  const md = `${FM}이건 첫 문장이에요. 이건 둘째 문장이에요. 이건 셋째 문장이에요.

이건 넷째 문장이에요. 이건 다섯째 문장이에요. 이건 여섯째 문장이에요. 이건 일곱째 문장이에요.`;
  assert.ok(rules(md).includes("monotone-endings"));
});
