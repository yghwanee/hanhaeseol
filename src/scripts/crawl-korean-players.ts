/**
 * 코리안리거 로스터 크롤 → src/data/korean-players.json
 *
 * 손으로 적은 "선수 → 팀" 표가 이적으로 낡는 것을 막기 위한 자동 갱신이다.
 * 무료 소스만 쓴다: 네이버 스포츠(축구) + MLB StatsAPI(야구, 키 불필요).
 */
import { writeFileSync, readFileSync } from "node:fs";
import { crawlKoreanPlayers } from "../lib/korean-players/crawl";
import type { KoreanPlayersData } from "../lib/korean-players/types";

const OUT = "src/data/korean-players.json";

function scheduleTeamNames(): Set<string> {
  const names = new Set<string>();
  for (const file of ["src/data/schedule.json", "src/data/schedule-archive.json"]) {
    try {
      const j = JSON.parse(readFileSync(file, "utf8")) as {
        schedules?: Array<{ homeTeam?: string; awayTeam?: string }>;
      };
      for (const s of j.schedules ?? []) {
        if (s.homeTeam) names.add(s.homeTeam);
        if (s.awayTeam) names.add(s.awayTeam);
      }
    } catch {
      // 파일이 없어도 크롤 자체는 계속한다(검증용 참고 데이터일 뿐).
    }
  }
  return names;
}

async function main() {
  const { data, failures } = await crawlKoreanPlayers();

  if (data.players.length === 0) {
    // 전멸이면 기존 파일을 덮지 않는다. 빈 로스터를 커밋하면 오늘치 콘텐츠에서
    // 코리안리거 신호가 통째로 사라진다.
    console.error("❌ 수집된 선수 0명 — 기존 파일 유지");
    for (const f of failures) console.error("   ", f);
    process.exit(1);
  }

  const known = scheduleTeamNames();
  const norm = (s: string) => s.replace(/\s+/g, "");
  const knownNorm = new Set([...known].map(norm));
  const unresolved = [
    ...new Set(
      data.players
        .filter((p) => !p.teams.some((t) => knownNorm.has(norm(t))))
        .map((p) => `${p.league}/${p.team}`),
    ),
  ].sort();

  const out: KoreanPlayersData = { ...data, unresolvedTeams: unresolved };
  writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`, "utf8");

  console.log(`✅ 코리안리거 ${out.players.length}명 → ${OUT}`);
  for (const p of out.players) {
    const ok = p.teams.some((t) => knownNorm.has(norm(t))) ? " " : "?";
    console.log(`  ${ok} ${p.name.padEnd(6)} ${p.team}  (${p.league})`);
  }
  if (unresolved.length) {
    console.log(`\n⚠️ 편성 표기와 못 맞춘 팀 ${unresolved.length}건 (점수만 손실, 오보 아님):`);
    for (const u of unresolved) console.log("   ", u);
  }
  if (failures.length) {
    console.log("\n⚠️ 일부 소스 실패:");
    for (const f of failures) console.log("   ", f);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
