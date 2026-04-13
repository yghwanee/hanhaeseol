import * as fs from "fs";
import * as path from "path";
import { crawlFreesupertips } from "../lib/crawlers/freesupertips";
import { crawlTipstrike } from "../lib/crawlers/tipstrike";
import { crawlSportytrader } from "../lib/crawlers/sportytrader";
import { crawlFootballpredictions } from "../lib/crawlers/footballpredictions";
import { crawlFootballpredictionsNet } from "../lib/crawlers/footballpredictions-net";
import { crawlDimers } from "../lib/crawlers/dimers";
import { crawlApwin } from "../lib/crawlers/apwin";
import { AnalysisData, AnalysisArticle } from "../types/analysis";
import { ScheduleData } from "../types/schedule";
import { translateText } from "../lib/translate";

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
    console.log(`✓ tipstrike: ${tsArticles.length}건 수집`);

    const stArticles = await crawlSportytrader(dateStr, scheduleData.schedules);
    console.log(`✓ sportytrader: ${stArticles.length}건 수집`);

    const fpArticles = await crawlFootballpredictions(dateStr, scheduleData.schedules);
    console.log(`✓ footballpredictions: ${fpArticles.length}건 수집`);

    const fpnArticles = await crawlFootballpredictionsNet(dateStr, scheduleData.schedules);
    console.log(`✓ footballpredictions.net: ${fpnArticles.length}건 수집`);

    const dmArticles = await crawlDimers(dateStr, scheduleData.schedules);
    console.log(`✓ dimers: ${dmArticles.length}건 수집`);

    const awArticles = await crawlApwin(dateStr, scheduleData.schedules);
    console.log(`✓ apwin: ${awArticles.length}건 수집\n`);

    newArticles.push(...fstArticles, ...tsArticles, ...stArticles, ...fpArticles, ...fpnArticles, ...dmArticles, ...awArticles);
  }

  // 번역 (content, prediction)
  console.log(`\n=== 번역 시작 (${newArticles.length}건) ===\n`);
  for (let i = 0; i < newArticles.length; i++) {
    const article = newArticles[i] as AnalysisArticle;
    try {
      if (article.content) {
        article.content = await translateText(article.content);
      }
      if (article.prediction) {
        article.prediction = await translateText(article.prediction);
      }
      console.log(`  ✓ [${i + 1}/${newArticles.length}] ${article.homeTeam} vs ${article.awayTeam}`);
    } catch (e) {
      console.error(`  ✗ [${i + 1}/${newArticles.length}] ${article.homeTeam} vs ${article.awayTeam}: ${e}`);
    }
    // 요청 간 딜레이
    if (i < newArticles.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  console.log();

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
