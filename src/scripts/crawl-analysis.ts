import * as fs from "fs";
import * as path from "path";
import { crawlFreesupertips } from "../lib/crawlers/freesupertips";
import { crawlTipstrike } from "../lib/crawlers/tipstrike";
import { AnalysisData } from "../types/analysis";
import { ScheduleData } from "../types/schedule";

async function main() {
  const today = new Date();

  const toDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  // 오늘 ~ +2일 (3일치, 과거 데이터는 기존 것 유지)
  const dates: string[] = [];
  for (let i = 0; i <= 2; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    dates.push(toDateStr(d));
  }

  console.log(`\n=== 분석글 크롤링 시작 (${dates.join(", ")}) ===\n`);

  // schedule.json 로드
  const schedulePath = path.resolve(__dirname, "../data/schedule.json");
  const scheduleData: ScheduleData = JSON.parse(fs.readFileSync(schedulePath, "utf-8"));

  // 기존 analysis.json 로드 (있으면)
  const analysisPath = path.resolve(__dirname, "../data/analysis.json");
  const publicPath = path.resolve(__dirname, "../../public/analysis.json");

  let existingData: AnalysisData = { lastUpdated: "", articles: [] };
  try {
    existingData = JSON.parse(fs.readFileSync(analysisPath, "utf-8"));
  } catch {
    // 파일 없으면 새로 생성
  }

  const newArticles = [];

  for (const dateStr of dates) {
    console.log(`--- ${dateStr} ---`);

    const fstArticles = await crawlFreesupertips(dateStr, scheduleData.schedules);
    console.log(`✓ freesupertips: ${fstArticles.length}건 수집`);

    const tsArticles = await crawlTipstrike(dateStr, scheduleData.schedules);
    console.log(`✓ tipstrike: ${tsArticles.length}건 수집\n`);

    newArticles.push(...fstArticles, ...tsArticles);
  }

  // 기존 데이터와 병합 (크롤링한 날짜만 교체, 나머지는 전부 유지)
  const keptArticles = existingData.articles.filter(
    (a) => !dates.includes(a.date)
  );

  const result: AnalysisData = {
    lastUpdated: new Date().toISOString(),
    articles: [...newArticles, ...keptArticles],
  };

  // 저장
  fs.writeFileSync(analysisPath, JSON.stringify(result, null, 2), "utf-8");
  fs.writeFileSync(publicPath, JSON.stringify(result, null, 2), "utf-8");

  console.log(`\n---`);
  console.log(`완료: 총 ${result.articles.length}건 → ${analysisPath}`);
}

main().catch(console.error);
