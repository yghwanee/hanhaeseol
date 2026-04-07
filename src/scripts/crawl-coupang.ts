import "dotenv/config";
import { crawlCoupangPlay } from "../lib/crawlers/coupang-play";
import { ScheduleData, Schedule } from "../types/schedule";
import { execSync } from "child_process";
import fs from "fs/promises";
import path from "path";

async function main() {
  const repoDir = process.cwd();

  // 최신 코드 pull
  try {
    execSync("git pull --rebase origin main", { cwd: repoDir, stdio: "inherit" });
  } catch {
    console.error("git pull 실패, 계속 진행");
  }

  // 오늘부터 7일치
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    dates.push(`${yyyy}-${mm}-${dd}`);
  }

  console.log(`쿠팡플레이 크롤링: ${dates[0]} ~ ${dates[dates.length - 1]}`);

  // 쿠팡플레이 크롤링
  const coupangSchedules: Schedule[] = [];
  for (const date of dates) {
    console.log(`[${date}] 크롤링 중...`);
    const schedules = await crawlCoupangPlay(date);
    console.log(`  ✓ 쿠팡플레이: ${schedules.length}건`);
    coupangSchedules.push(...schedules);
  }

  // 기존 schedule.json 읽기
  const outPath = path.join(repoDir, "src/data/schedule.json");
  const existing: ScheduleData = JSON.parse(await fs.readFile(outPath, "utf-8"));

  // 기존 데이터에서 쿠팡플레이 제거 후 새 데이터 합치기
  const filtered = existing.schedules.filter((s) => s.platform !== "쿠팡플레이");
  const merged = [...filtered, ...coupangSchedules].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });

  const data: ScheduleData = {
    lastUpdated: new Date().toISOString(),
    schedules: merged,
  };

  await fs.writeFile(outPath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`완료: 쿠팡플레이 ${coupangSchedules.length}건 추가 → 총 ${merged.length}건`);

  // git commit & push
  try {
    execSync('git add src/data/schedule.json', { cwd: repoDir, stdio: "inherit" });
    execSync('git diff --staged --quiet', { cwd: repoDir, stdio: "inherit" });
    console.log("변경사항 없음, push 생략");
  } catch {
    // diff --quiet가 exit 1이면 변경사항 있음
    execSync('git commit -m "chore: update coupang play schedule data"', { cwd: repoDir, stdio: "inherit" });
    execSync('git push', { cwd: repoDir, stdio: "inherit" });
    console.log("push 완료!");
  }
}

main().catch((err) => {
  console.error("크롤링 실패:", err);
  process.exit(1);
});
