// src/scripts/hook-preview.ts
//
// 이번 실행이 게시한다면 나갈 후킹 문장을 찍는다(게시 없음). social-preview.yml 이 hero:star 뒤에 돌린다.
// 쇼츠 제목 · 유튜브 설명/인스타 피드/릴스 첫 줄 · 틱톡 첫 줄 — 전부 실제 게시 스크립트와 같은 함수.

import { getKstToday } from "@/lib/instagram";
import { getPostSlot } from "@/lib/post-slot";
import { buildHookLine, buildShortsTitle } from "@/lib/shorts-title";
import { buildTiktokCaption } from "@/lib/tiktok-caption";
import { coverHookContext } from "@/lib/cover-hook";

const { today, mm, dd } = getKstToday();
const slot = getPostSlot(today);
const c = coverHookContext(today);
const branch = c?.national ? "대표팀" : c?.star ? `팀 대표 선수(${c.star.stat})` : c?.isPlayer ? "코리안리거" : c ? `팀 경기${c.teamFact ? `(${c.teamFact.team} ${c.teamFact.fact})` : ""}` : "경기 없음";

console.log(`🎯 ${today} ${slot} · 주어 분기: ${branch}`);
console.log(`쇼츠 제목   | ${buildShortsTitle(mm, dd, today, slot)}`);
for (const s of ["youtube-desc", "ig-feed", "ig-reel"] as const) {
  console.log(`${s.padEnd(11)} | ${buildHookLine(today, slot, s)}`);
}
console.log(`틱톡 첫 줄  | ${buildTiktokCaption(today).split("\n")[0]}`);
