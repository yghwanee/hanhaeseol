import * as fs from "fs";
import * as path from "path";
import { crawlFreesupertips } from "../lib/crawlers/freesupertips";
import { AnalysisData } from "../types/analysis";
import { ScheduleData } from "../types/schedule";

async function main() {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  console.log(`\n=== 분석글 크롤링 시작 (${dateStr}) ===\n`);

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

  // freesupertips 크롤링
  const newArticles = await crawlFreesupertips(dateStr, scheduleData.schedules);
  console.log(`\n✓ freesupertips: ${newArticles.length}건 수집`);

  // 기존 데이터와 병합 (최근 3일만 유지, 같은 날짜는 교체)
  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const cutoffDate = `${threeDaysAgo.getFullYear()}-${String(threeDaysAgo.getMonth() + 1).padStart(2, "0")}-${String(threeDaysAgo.getDate()).padStart(2, "0")}`;

  const keptArticles = existingData.articles.filter(
    (a) => a.date !== dateStr && a.date >= cutoffDate
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
