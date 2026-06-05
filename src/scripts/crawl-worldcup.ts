import "dotenv/config";
import { crawlWorldcup } from "../lib/crawlers/worldcup";
import { ScheduleData } from "../types/schedule";
import fs from "fs/promises";
import path from "path";

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
}

main().catch((err) => {
  console.error("월드컵 크롤링 실패:", err);
  process.exit(1);
});
