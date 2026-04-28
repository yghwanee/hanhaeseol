import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { fetchNaverTeamRecords, CATEGORY_ID } from "../lib/team-records/naver";
import { fetchEspnNbaRecords } from "../lib/team-records/espn-nba";
import type { TeamRecord, TeamRecordsData, TeamRecordsMap } from "../types/team-record";

/** 네이버 NBA team-rank가 정규시즌 종료 후엔 비어있으므로(플레이오프 미지원),
 *  네이버 응답을 ESPN 응답으로 보강한다. ESPN 키(한국어 풀명)와 네이버 키(있다면)를
 *  같이 등록해 schedule.json의 어떤 표기든 매칭되도록 한다. */
function mergeNbaRecords(
  naver: Record<string, TeamRecord>,
  espn: Record<string, TeamRecord>,
): Record<string, TeamRecord> {
  const merged: Record<string, TeamRecord> = { ...naver };
  // ESPN 데이터는 last5가 채워져 있으므로 우선. 네이버에 같은 이름이 있어도 덮어씀.
  for (const [k, v] of Object.entries(espn)) merged[k] = v;
  return merged;
}

async function main() {
  const records: TeamRecordsMap = {};
  const leagues = Object.keys(CATEGORY_ID);

  for (const league of leagues) {
    try {
      const map = await fetchNaverTeamRecords(league);
      records[league] = map;
      console.log(`${league}: ${Object.keys(map).length}팀 수집`);
    } catch (e) {
      console.error(`${league} 실패:`, (e as Error).message);
      records[league] = {};
    }
  }

  // NBA: 네이버 응답에 last5가 비어있으면(플레이오프 기간) ESPN 데이터로 보강.
  const nbaNaver = records["NBA"] ?? {};
  const allEmpty = Object.values(nbaNaver).every((r) => !r.last5);
  if (allEmpty) {
    try {
      console.log("NBA: 네이버 last5 비어있음 → ESPN로 보강");
      const espn = await fetchEspnNbaRecords();
      records["NBA"] = mergeNbaRecords(nbaNaver, espn);
      console.log(`NBA: ESPN로 ${Object.keys(espn).length}팀 last5 갱신`);
    } catch (e) {
      console.error("NBA ESPN 실패:", (e as Error).message);
    }
  }

  const data: TeamRecordsData = {
    lastUpdated: new Date().toISOString(),
    records,
  };

  const jsonStr = JSON.stringify(data, null, 2);
  const outPath = path.join(process.cwd(), "src/data/team-records.json");
  const publicPath = path.join(process.cwd(), "public/team-records.json");
  await fs.writeFile(outPath, jsonStr, "utf-8");
  await fs.writeFile(publicPath, jsonStr, "utf-8");
  console.log(`완료: ${outPath}`);
}

main().catch((err) => {
  console.error("팀 기록 크롤링 실패:", err);
  process.exit(1);
});
