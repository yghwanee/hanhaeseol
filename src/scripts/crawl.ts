import { crawlDateRange } from "../lib/crawlers";
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

  console.log(`크롤링 시작: ${dates[0]} ~ ${dates[dates.length - 1]}`);
  console.log("---");

  const data = await crawlDateRange(dates);

  const outPath = path.join(process.cwd(), "src/data/schedule.json");
  await fs.writeFile(outPath, JSON.stringify(data, null, 2), "utf-8");

  console.log("---");
  console.log(`완료: 총 ${data.schedules.length}건 → ${outPath}`);
}

main().catch((err) => {
  console.error("크롤링 실패:", err);
  process.exit(1);
});
