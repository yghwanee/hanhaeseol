import "dotenv/config";
import { crawlDateRange } from "../lib/crawlers";
import { ScheduleData } from "../types/schedule";
import fs from "fs/promises";
import path from "path";

async function main() {
  // 오늘부터 7일치 크롤링
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    dates.push(`${yyyy}-${mm}-${dd}`);
  }

  // 기존 데이터 로드 (실패한 플랫폼 데이터 보존용)
  const outPath = path.join(process.cwd(), "src/data/schedule.json");
  let existing: ScheduleData | null = null;
  try {
    const raw = await fs.readFile(outPath, "utf-8");
    existing = JSON.parse(raw);
  } catch {
    // 파일 없으면 무시
  }

  console.log(`크롤링 시작: ${dates[0]} ~ ${dates[dates.length - 1]}`);
  console.log("---");

  const data = await crawlDateRange(dates, existing);

  const jsonStr = JSON.stringify(data, null, 2);
  await fs.writeFile(outPath, jsonStr, "utf-8");

  // public/schedule.json에도 저장 (클라이언트 fetch용)
  const publicPath = path.join(process.cwd(), "public/schedule.json");
  await fs.writeFile(publicPath, jsonStr, "utf-8");

  console.log("---");
  console.log(`완료: 총 ${data.schedules.length}건 → ${outPath}`);
}

main().catch((err) => {
  console.error("크롤링 실패:", err);
  process.exit(1);
});
