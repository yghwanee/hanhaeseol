import "dotenv/config";
import { crawlWorldcup, crawlWorldcupStandings } from "../lib/crawlers/worldcup";
import { ScheduleData } from "../types/schedule";
import { WorldCupStandings, WorldCupGroup } from "../types/worldcup";
import fs from "fs/promises";
import path from "path";

// 두 곳(src/data, public)에 동일 JSON 저장.
async function writeBoth(name: string, json: string) {
  await fs.writeFile(path.join(process.cwd(), "src/data", name), json, "utf-8");
  await fs.writeFile(path.join(process.cwd(), "public", name), json, "utf-8");
}

// 정상 순위는 항상 (승+무+패 == 경기수). 이게 깨진 행 = 네이버가 '진행중' 경기를
// 결과로 미리 집계한 것(예: 전반 1-0인데 벌써 1승·3점). 그 조는 신뢰할 수 없다.
function groupHasLiveContamination(g: WorldCupGroup): boolean {
  return g.teams.some((t) => t.win + t.draw + t.loss !== t.played);
}

// 진행중 경기가 섞인 조는 직전 정상 스냅샷(기존 파일)을 그대로 유지한다.
// → 경기가 끝나 네이버 집계가 정합해지면(경기수 증가) 다음 크롤에서 자연히 반영됨.
// 나머지 조는 새 데이터로 갱신해 '바로바로 반영'은 유지.
function mergePreservingLive(
  fresh: WorldCupStandings,
  existing: WorldCupStandings | null,
): { merged: WorldCupStandings; frozen: string[] } {
  const existingByGroup = new Map((existing?.groups ?? []).map((g) => [g.group, g]));
  const frozen: string[] = [];
  const groups = fresh.groups.map((g) => {
    if (groupHasLiveContamination(g)) {
      const prev = existingByGroup.get(g.group);
      if (prev) {
        frozen.push(g.group);
        return prev;
      }
    }
    return g;
  });
  return { merged: { lastUpdated: fresh.lastUpdated, groups }, frozen };
}

// 월드컵 편성은 schedule.json과 분리된 worldcup.json으로 관리한다.
// (매시간 도는 일반 크롤러가 schedule.json을 덮어써도 월드컵 데이터가 살아남도록.)
// server-data.loadScheduleData()가 읽을 때 두 파일을 머지한다.
async function main() {
  const dataPath = path.join(process.cwd(), "src/data/worldcup.json");
  const publicPath = path.join(process.cwd(), "public/worldcup.json");

  let existing: ScheduleData | null = null;
  try {
    existing = JSON.parse(await fs.readFile(dataPath, "utf-8"));
  } catch {
    // 파일 없으면 무시
  }

  console.log("월드컵 크롤링 시작 (네이버)...");
  const schedules = await crawlWorldcup();
  console.log(`  → ${schedules.length}건 수집`);

  // 0건이면 네트워크/소스 장애로 보고 기존 데이터 보존 (덮어쓰지 않음).
  if (schedules.length === 0) {
    if (existing && existing.schedules.length > 0) {
      console.log("  ↩ 0건 — 기존 worldcup.json 보존 (덮어쓰기 안 함)");
      return;
    }
    console.log("  ⚠ 0건 + 기존 데이터 없음 — 빈 파일 생성");
  }

  const data: ScheduleData = {
    lastUpdated: new Date().toISOString(),
    schedules,
  };
  const json = JSON.stringify(data, null, 2);
  await fs.writeFile(dataPath, json, "utf-8");
  await fs.writeFile(publicPath, json, "utf-8");
  console.log(`완료: ${schedules.length}건 → worldcup.json`);

  // 조별 순위 (실패/0건이면 기존 파일 보존)
  console.log("월드컵 조별 순위 수집...");
  const standings = await crawlWorldcupStandings();
  if (standings && standings.groups.length > 0) {
    // 진행중 경기가 섞인 조는 직전 정상 스냅샷 유지 (네이버가 라이브 결과를 미리 집계하는 문제 회피).
    let existingStandings: WorldCupStandings | null = null;
    try {
      existingStandings = JSON.parse(
        await fs.readFile(path.join(process.cwd(), "src/data/worldcup-standings.json"), "utf-8"),
      );
    } catch {
      // 기존 파일 없으면 신규 데이터 그대로 사용
    }
    const { merged, frozen } = mergePreservingLive(standings, existingStandings);
    if (frozen.length > 0) {
      console.log(`  ⏸ 진행중 경기로 ${frozen.join(",")}조는 직전 순위 유지 (라이브 집계 제외)`);
    }
    await writeBoth("worldcup-standings.json", JSON.stringify(merged, null, 2));
    console.log(`완료: ${merged.groups.length}개 조 → worldcup-standings.json`);
  } else {
    console.log("  ↩ 순위 0건/실패 — 기존 worldcup-standings.json 보존");
  }
}

main().catch((err) => {
  console.error("월드컵 크롤링 실패:", err);
  process.exit(1);
});
