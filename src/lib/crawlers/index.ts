import { Schedule, ScheduleData, Platform, Sport } from "@/types/schedule";

const ALLOWED_SPORTS: Set<string> = new Set<Sport>(["축구", "야구", "농구", "배구"]);
import { crawlSpotvNow } from "./spotv-now";
import { crawlSpotvTv } from "./spotv-tv";
import { crawlMbcSports } from "./mbc-sports";
import { crawlTvnSports } from "./tvn-sports";
import { crawlSbsSports } from "./sbs-sports";
import { crawlKbsSports } from "./kbs-sports";
import { crawlAppleTv } from "./apple-tv";
import { crawlCoupangPlay } from "./coupang-play";
import { crawlTving } from "./tving";

// 각 크롤러가 담당하는 플랫폼 목록
const CRAWLER_PLATFORMS: Platform[][] = [
  ["SPOTV NOW"],
  ["SPOTV", "SPOTV2"],
  ["MBC SPORTS+"],
  ["tvN SPORTS"],
  ["SBS Sports"],
  ["KBS N SPORTS"],
  ["Apple TV+"],
  ["쿠팡플레이"],
  ["티빙"],
];

export async function crawlAll(date: string, existingSchedules: Schedule[]): Promise<Schedule[]> {
  const results = await Promise.allSettled([
    crawlSpotvNow(date),
    crawlSpotvTv(date),
    crawlMbcSports(date),
    crawlTvnSports(date),
    crawlSbsSports(date),
    crawlKbsSports(date),
    crawlAppleTv(date),
    crawlCoupangPlay(date),
    crawlTving(date),
  ]);

  const labels = ["SPOTV NOW", "SPOTV/SPOTV2", "MBC SPORTS+", "tvN SPORTS", "SBS Sports", "KBS N SPORTS", "Apple TV+", "쿠팡플레이", "티빙"];
  const allSchedules: Schedule[] = [];
  const failedPlatforms = new Set<Platform>();

  results.forEach((result, i) => {
    if (result.status === "fulfilled" && result.value.length > 0) {
      console.log(`  ✓ ${labels[i]}: ${result.value.length}건`);
      allSchedules.push(...result.value);
    } else if (result.status === "rejected") {
      console.error(`  ✗ ${labels[i]}: ${result.reason}`);
      CRAWLER_PLATFORMS[i].forEach((p) => failedPlatforms.add(p));
    } else {
      // fulfilled but 0건 — 기존 데이터가 있으면 실패로 간주
      const hadData = existingSchedules.some(
        (s) => s.date === date && CRAWLER_PLATFORMS[i].includes(s.platform)
      );
      if (hadData) {
        console.log(`  △ ${labels[i]}: 0건 (기존 데이터 유지)`);
        CRAWLER_PLATFORMS[i].forEach((p) => failedPlatforms.add(p));
      } else {
        console.log(`  ✓ ${labels[i]}: 0건`);
      }
    }
  });

  // 실패한 플랫폼은 기존 데이터에서 가져오기
  if (failedPlatforms.size > 0) {
    const preserved = existingSchedules.filter(
      (s) => s.date === date && failedPlatforms.has(s.platform)
    );
    if (preserved.length > 0) {
      console.log(`  ↩ 기존 데이터 보존: ${[...failedPlatforms].join(", ")} (${preserved.length}건)`);
      allSchedules.push(...preserved);
    }
  }

  // 4종목만 + 팀 대 팀 경기만 + 시간순 정렬
  const filtered = allSchedules
    .filter((s) => ALLOWED_SPORTS.has(s.sport))
    .filter((s) => s.homeTeam && s.awayTeam)
    .filter((s) => s.homeTeam !== "미정" && s.awayTeam !== "미정");

  return filterLateJoinBroadcasts(filtered).sort((a, b) => a.time.localeCompare(b.time));
}

// 중간 투입 중계(경기 시작 후 한참 지나서 편성된 생중계) 제거
// 예: KBS가 KBL 끝난 뒤 21:00부터 18:30 시작한 KBO 경기를 이어받아 "생방송"으로 편성
// 같은 매치의 가장 이른 시작 시각과 60분 이상 차이 나는 항목은 제외
function filterLateJoinBroadcasts(schedules: Schedule[]): Schedule[] {
  const matchKey = (s: Schedule) =>
    `${s.date}|${s.sport}|${s.league}|${[s.homeTeam, s.awayTeam].sort().join("|")}`;

  const toMinutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  };

  const earliestByMatch = new Map<string, number>();
  for (const s of schedules) {
    const key = matchKey(s);
    const minutes = toMinutes(s.time);
    const prev = earliestByMatch.get(key);
    if (prev === undefined || minutes < prev) {
      earliestByMatch.set(key, minutes);
    }
  }

  return schedules.filter((s) => {
    const earliest = earliestByMatch.get(matchKey(s))!;
    const diff = toMinutes(s.time) - earliest;
    if (diff >= 60) {
      console.log(`  ⊘ 중간 투입 중계 제외: ${s.platform} ${s.date} ${s.time} ${s.homeTeam} vs ${s.awayTeam} (earliest ${Math.floor(earliest / 60)}:${String(earliest % 60).padStart(2, "0")})`);
      return false;
    }
    return true;
  });
}

export async function crawlDateRange(dates: string[], existing: ScheduleData | null): Promise<ScheduleData> {
  const existingSchedules = existing?.schedules || [];
  const allSchedules: Schedule[] = [];

  for (const date of dates) {
    console.log(`[${date}] 크롤링 중...`);
    const schedules = await crawlAll(date, existingSchedules);
    allSchedules.push(...schedules);
  }

  return {
    lastUpdated: new Date().toISOString(),
    schedules: allSchedules,
  };
}
