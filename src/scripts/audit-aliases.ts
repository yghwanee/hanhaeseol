import fs from "node:fs/promises";
import path from "node:path";
import type { ResultsData } from "@/types/results";
import type { ScheduleData, Schedule } from "@/types/schedule";
import { categoriesForLeague, findResult } from "@/lib/results/lookup";
import { lookupTeamRecord } from "@/lib/team-records/lookup";
import type { TeamRecordsMap } from "@/types/team-record";

/**
 * 팀명 alias 미스매치 감사.
 *
 * "결과 데이터는 있는데 findResult가 실패해 카드에 스코어가 안 뜨는" 유형
 * (예: LAFC 3-1 솔트레이크가 안 붙던 2026-07-23 버그)을 잡는다.
 *
 * 유효한 검증은 이것 하나뿐 — 스케줄 팀표기와 네이버 결과 표기를 실제로 대조.
 * (alias map 키를 결과 primary와 비교하는 방식은 무효: primary는 이미 매핑된 값이라
 *  네이버 원본 표기를 알 수 없음.)
 *
 * 오프시즌 리그는 스케줄에 경기가 없어 검증 불가 → 개막 후 실행해야 의미 있음.
 * 실행 전 최신화: `npm run crawl && npm run crawl:results`
 */

const ROOT = process.cwd();

async function readJson<T>(p: string): Promise<T> {
  return JSON.parse(await fs.readFile(path.join(ROOT, p), "utf8")) as T;
}

function mergeByKey(...datas: ResultsData[]): ResultsData {
  const byKey: ResultsData["byKey"] = {};
  for (const d of datas) Object.assign(byKey, d.byKey);
  return { lastUpdated: "", byKey, results: [] };
}

/** date+categoryId 아래에 team을 언급하는 결과 키가 있으면(=결과는 존재) 반환. */
function nearMiss(
  results: ResultsData,
  date: string,
  categoryId: string,
  home: string,
  away: string,
): string | null {
  const prefix = `${date}|${categoryId}|`;
  for (const k of Object.keys(results.byKey)) {
    if (!k.startsWith(prefix)) continue;
    if (k.includes(home) || k.includes(away)) return k;
  }
  return null;
}

async function main(): Promise<void> {
  const schedule = await readJson<ScheduleData>("public/schedule.json");
  const results = await readJson<ResultsData>("public/results.json");
  const archive = await readJson<ResultsData>("public/results-archive.json");
  const merged = mergeByKey(archive, results);

  const stat: Record<string, { match: number; miss: number; noresult: number }> = {};
  const misses: string[] = [];

  for (const s of schedule.schedules as Schedule[]) {
    const cats = categoriesForLeague(s.league);
    if (cats.length === 0) continue;
    stat[s.league] ??= { match: 0, miss: 0, noresult: 0 };

    // fuzzy:false — 카드는 한쪽 일치 안전망으로 붙지만, 감사는 alias 표의 빈칸을 드러내야 한다
    // (전적·로고는 그 안전망을 안 탄다).
    if (findResult(merged, s, { fuzzy: false })) {
      stat[s.league].match++;
      continue;
    }
    let near: string | null = null;
    for (const c of cats) {
      near = nearMiss(merged, s.date, c, s.homeTeam, s.awayTeam);
      if (near) break;
    }
    if (near) {
      const r = merged.byKey[near];
      stat[s.league].miss++;
      misses.push(
        `${s.date} [${s.league}/${s.platform}] "${s.homeTeam}" vs "${s.awayTeam}"` +
          `  ↔ resultKey="${near}" (${r.homeScore}-${r.awayScore} ${r.status})`,
      );
    } else {
      stat[s.league].noresult++;
    }
  }

  console.log("=== alias 미스매치 감사 ===");
  console.log("리그별 (match=매칭, MISS=결과있는데실패, noresult=결과아직없음)");
  for (const [lg, v] of Object.entries(stat)) {
    console.log(`  ${lg.padEnd(16)} match=${v.match} MISS=${v.miss} noresult=${v.noresult}`);
  }
  console.log("");
  if (misses.length === 0) {
    console.log("✅ 미스매치 없음.");
  } else {
    console.log(`🔴 미스매치 ${misses.length}건 — team-name-aliases.ts에 네이버 표기 키 보정 필요:`);
    for (const m of misses) console.log("  " + m);
    process.exitCode = 1;
  }
  console.log("");
  console.log("주의: 오프시즌 리그는 noresult로만 잡힘(검증 불가). 개막 후 재실행할 것.");

  // ── 최근 5경기 전적(team-records) 감사 ─────────────────────────────
  // 🔴 전적은 결과와 **다른 네이버 API**(순위·시즌 통계)라 표기도 따로 갈린다.
  // 2026-09-15: 결과는 "인테르", 전적은 "인테르나치오날레" — 결과만 감사해서 인터 밀란 뱃지 누락을 못 봤다.
  // 전적 표에 그 리그가 있는데 편성 팀이 조회 안 되면 MISS. 같은 리그에서 어떤 편성 팀에도
  // 안 쓰인 전적 표기를 옆에 찍어 짝을 사람이 바로 고를 수 있게 한다(자동 짝짓기는 안 한다 — 추측 금지).
  const { records } = await readJson<{ records: TeamRecordsMap }>("public/team-records.json");
  const recMiss = new Map<string, Set<string>>();
  const recStat: Record<string, { match: number; miss: number }> = {};
  for (const s of schedule.schedules as Schedule[]) {
    if (!records[s.league]) continue;
    recStat[s.league] ??= { match: 0, miss: 0 };
    for (const team of [s.homeTeam, s.awayTeam]) {
      if (!team) continue;
      if (lookupTeamRecord(records, s.league, team)) {
        recStat[s.league].match++;
      } else {
        recStat[s.league].miss++;
        if (!recMiss.has(s.league)) recMiss.set(s.league, new Set());
        recMiss.get(s.league)!.add(team);
      }
    }
  }
  console.log("");
  console.log("=== 최근 5경기 전적 감사 ===");
  for (const [lg, v] of Object.entries(recStat)) {
    console.log(`  ${lg.padEnd(16)} match=${v.match} MISS=${v.miss}`);
  }
  if (recMiss.size === 0) {
    console.log("✅ 전적 미스매치 없음.");
    return;
  }
  let total = 0;
  console.log("🔴 전적 미스매치 — team-name-aliases.ts 에 전적 API 표기 키 보정 필요:");
  for (const [lg, teams] of recMiss) {
    total += teams.size;
    const usedRecs = new Set(
      (schedule.schedules as Schedule[])
        .filter((s) => s.league === lg)
        .flatMap((s) => [s.homeTeam, s.awayTeam])
        .map((t) => t && lookupTeamRecord(records, lg, t))
        .filter(Boolean),
    );
    const unused = Object.entries(records[lg])
      .filter(([, rec]) => !usedRecs.has(rec))
      .map(([name]) => name);
    console.log(`  [${lg}] 편성 표기: ${[...teams].map((t) => `"${t}"`).join(", ")}`);
    console.log(`         짝 후보(편성에 안 쓰인 전적 표기): ${unused.join(", ") || "(없음 — 네이버 전적 표에 팀 자체가 없음)"}`);
  }
  console.log(`  합계 ${total}팀`);
  process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
