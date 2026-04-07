import { Schedule, ScheduleData, Sport } from "@/types/schedule";

const ALLOWED_SPORTS: Set<string> = new Set<Sport>(["축구", "야구", "농구", "배구"]);
import { crawlSpotvNow } from "./spotv-now";
import { crawlSpotvTv } from "./spotv-tv";
import { crawlMbcSports } from "./mbc-sports";
import { crawlTvnSports } from "./tvn-sports";
import { crawlSbsSports } from "./sbs-sports";
import { crawlKbsSports } from "./kbs-sports";

export async function crawlAll(date: string): Promise<Schedule[]> {
  const results = await Promise.allSettled([
    crawlSpotvNow(date),
    crawlSpotvTv(date),
    crawlMbcSports(date),
    crawlTvnSports(date),
    crawlSbsSports(date),
    crawlKbsSports(date),
  ]);

  const labels = ["SPOTV NOW", "SPOTV/SPOTV2", "MBC SPORTS+", "tvN SPORTS", "SBS Sports", "KBS N SPORTS"];
  const allSchedules: Schedule[] = [];

  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      console.log(`  ✓ ${labels[i]}: ${result.value.length}건`);
      allSchedules.push(...result.value);
    } else {
      console.error(`  ✗ ${labels[i]}: ${result.reason}`);
    }
  });

  // 4종목만 + 팀 대 팀 경기만 + 시간순 정렬
  return allSchedules
    .filter((s) => ALLOWED_SPORTS.has(s.sport))
    .filter((s) => s.homeTeam && s.awayTeam)
    .sort((a, b) => a.time.localeCompare(b.time));
}

export async function crawlDateRange(dates: string[]): Promise<ScheduleData> {
  const allSchedules: Schedule[] = [];

  for (const date of dates) {
    console.log(`[${date}] 크롤링 중...`);
    const schedules = await crawlAll(date);
    allSchedules.push(...schedules);
  }

  return {
    lastUpdated: new Date().toISOString(),
    schedules: allSchedules,
  };
}
