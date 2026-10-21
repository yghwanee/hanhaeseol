import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeStarters } from "./merge";
import type { MatchStarters } from "@/types/starter";

const S = (name: string) => ({ name, era: "3.00", ip: "", w: 0, l: 0, so: 0 });
const entry = (teams: MatchStarters["teams"]): MatchStarters => ({ league: "kbo", teams });

test("이번 크롤에 없는 지난 경기 선발은 지킨다 — 날짜가 넘어가도 '선발 미발표'로 안 바뀐다", () => {
  const prev = { "2026-10-20|KIA-LG": entry({ KIA: S("시라카와"), LG: S("카라스코") }) };
  const out = mergeStarters(prev, {}, "2026-10-22");
  assert.equal(out["2026-10-20|KIA-LG"].teams.LG.name, "카라스코");
});

test("새로 받은 값이 이긴다(선발 교체)", () => {
  const prev = { "2026-10-23|KIA-LG": entry({ KIA: S("네일"), LG: S("임찬규") }) };
  const next = { "2026-10-23|KIA-LG": entry({ LG: S("손주영") }) };
  const out = mergeStarters(prev, next, "2026-10-22");
  assert.equal(out["2026-10-23|KIA-LG"].teams.LG.name, "손주영");
  assert.equal(out["2026-10-23|KIA-LG"].teams.KIA.name, "네일");
});

test("매치 보존 기간(14일)보다 오래된 키는 버린다", () => {
  const prev = { "2026-10-01|KIA-LG": entry({ KIA: S("a") }), "2026-10-08|KIA-LG": entry({ KIA: S("b") }) };
  const out = mergeStarters(prev, {}, "2026-10-22");
  assert.deepEqual(Object.keys(out), ["2026-10-08|KIA-LG"]);
});
