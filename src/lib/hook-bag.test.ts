import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { HOOKS_DIR, HOOK_BAG_START, HOOK_BAG_RECENT, hookBagIndex } from "./hook-card";

const files = fs.readdirSync(HOOKS_DIR).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
const day = (n: number) => new Date(Date.parse(`${HOOK_BAG_START}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

test("셔플백: 한 바퀴(풀 크기만큼) 안에 같은 사진이 두 번 안 나온다", () => {
  const seen = new Set<string>();
  for (let i = 0; i < files.length; i++) {
    seen.add(files[hookBagIndex(day(Math.floor(i / 2)), i % 2 === 0 ? "evening" : "morning", files.length, files)]);
  }
  assert.equal(seen.size, files.length);
});

test("셔플백: 풀을 바꾼 직후 첫 바퀴는 직전 바퀴에 쓴 사진(HOOK_BAG_RECENT)을 맨 뒤에 둔다", () => {
  const recent = new Set(HOOK_BAG_RECENT.filter((f) => files.includes(f)));
  const freshCount = files.length - recent.size;
  for (let i = 0; i < freshCount; i++) {
    const f = files[hookBagIndex(day(Math.floor(i / 2)), i % 2 === 0 ? "evening" : "morning", files.length, files)];
    assert.ok(!recent.has(f), `${i}번째 칸에 최근 사용 사진 ${f}`);
  }
});

test("HOOK_BAG_RECENT 는 풀에 실제로 있는 파일명이다(오타면 맨 뒤로 못 민다)", () => {
  for (const f of HOOK_BAG_RECENT) assert.ok(files.includes(f), f);
});
