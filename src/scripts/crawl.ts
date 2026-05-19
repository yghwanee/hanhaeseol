import "dotenv/config";
import { crawlDateRange } from "../lib/crawlers";
import { Schedule, ScheduleData } from "../types/schedule";
import fs from "fs/promises";
import path from "path";

async function main() {
  // 오늘(KST)부터 7일치 크롤링
  // GitHub Actions는 UTC로 동작하므로 KST(UTC+9) 기준 날짜를 계산해야 한다.
  const dates: string[] = [];
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  for (let i = 0; i < 7; i++) {
    const d = new Date(nowKst);
    d.setUTCDate(nowKst.getUTCDate() + i);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
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

  // schedule-archive.json 누적: 현재 schedule.json에 들어간 모든 경기를 archive에
  // id 기준 merge (새 데이터가 우선). 7일이 지나 schedule.json에서 빠져도 archive에는 영구 보존.
  // /match/[slug] 페이지가 archive에서 매치를 찾아 404를 막고, SEO 자산으로 유지된다.
  const archivePath = path.join(process.cwd(), "src/data/schedule-archive.json");
  const archivePublicPath = path.join(process.cwd(), "public/schedule-archive.json");
  let archive: ScheduleData = { lastUpdated: "", schedules: [] };
  try {
    const raw = await fs.readFile(archivePath, "utf-8");
    archive = JSON.parse(raw);
  } catch {
    // 파일 없으면 새로 시작
  }

  const byId = new Map<string, Schedule>();
  for (const s of archive.schedules) byId.set(s.id, s);
  for (const s of data.schedules) byId.set(s.id, s); // 최신 정보로 덮어쓰기

  const sortedSchedules = [...byId.values()].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });

  const newArchive: ScheduleData = {
    lastUpdated: new Date().toISOString(),
    schedules: sortedSchedules,
  };
  const archiveJson = JSON.stringify(newArchive, null, 2);
  await fs.writeFile(archivePath, archiveJson, "utf-8");
  await fs.writeFile(archivePublicPath, archiveJson, "utf-8");

  console.log("---");
  console.log(`완료: 총 ${data.schedules.length}건 → ${outPath}`);
  console.log(`archive: 총 ${sortedSchedules.length}건 (${archive.schedules.length} + 신규 ${sortedSchedules.length - archive.schedules.length}건)`);
}

main().catch((err) => {
  console.error("크롤링 실패:", err);
  process.exit(1);
});
