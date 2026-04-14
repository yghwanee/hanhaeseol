import * as fs from "fs";
import * as path from "path";
import { crawlFreesupertips } from "../lib/crawlers/freesupertips";
import { crawlTipstrike } from "../lib/crawlers/tipstrike";
import { crawlSportytrader } from "../lib/crawlers/sportytrader";
import { crawlFootballpredictions } from "../lib/crawlers/footballpredictions";
import { crawlFootballpredictionsNet } from "../lib/crawlers/footballpredictions-net";
import { crawlDimers } from "../lib/crawlers/dimers";
import { crawl7M } from "../lib/crawlers/7m";
import { crawlLiveman } from "../lib/crawlers/liveman";
import { crawlScores24 } from "../lib/crawlers/scores24";
import { crawlCovers } from "../lib/crawlers/covers";
import { crawlPickdawgz } from "../lib/crawlers/pickdawgz";
import { crawlTonyspicks } from "../lib/crawlers/tonyspicks";
import { AnalysisData, AnalysisArticle } from "../types/analysis";
import { ScheduleData } from "../types/schedule";
import { translateText } from "../lib/translate";

async function main() {
  // KST 기준 오늘 ~ +2일 (GitHub Actions UTC 환경 보정)
  const todayKst = new Date(Date.now() + 9 * 60 * 60 * 1000);

  const toDateStr = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

  const dates: string[] = [];
  for (let i = 0; i <= 2; i++) {
    const d = new Date(todayKst);
    d.setUTCDate(todayKst.getUTCDate() + i);
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

    const smArticles = await crawl7M(dateStr, scheduleData.schedules);
    console.log(`✓ 7M: ${smArticles.length}건 수집\n`);

    const lmArticles = await crawlLiveman(dateStr, scheduleData.schedules);
    console.log(`✓ liveman: ${lmArticles.length}건 수집\n`);

    const s24Articles = await crawlScores24(dateStr, scheduleData.schedules);
    console.log(`✓ scores24: ${s24Articles.length}건 수집\n`);

    const cvArticles = await crawlCovers(dateStr, scheduleData.schedules);
    console.log(`✓ covers: ${cvArticles.length}건 수집\n`);

    const pdArticles = await crawlPickdawgz(dateStr, scheduleData.schedules);
    console.log(`✓ pickdawgz: ${pdArticles.length}건 수집\n`);

    const tpArticles = await crawlTonyspicks(dateStr, scheduleData.schedules);
    console.log(`✓ tonyspicks: ${tpArticles.length}건 수집\n`);

    newArticles.push(...fstArticles, ...tsArticles, ...stArticles, ...fpArticles, ...fpnArticles, ...dmArticles, ...smArticles, ...lmArticles, ...s24Articles, ...cvArticles, ...pdArticles, ...tpArticles);
  }

  // 이모지 제거 (모든 기사의 content/prediction)
  const emojiRe = new RegExp(
    "[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{1F000}-\\u{1F02F}]",
    "gu"
  );
  const stripEmoji = (s: string) =>
    s.replace(emojiRe, "").replace(/\s+/g, " ").trim();

  // 번역 (content, prediction) - 7M은 이미 한국어이므로 제외
  const toTranslate = newArticles.filter((a) => !a.id.includes("-7m-") && !a.id.includes("-liveman-"));
  console.log(`\n=== 번역 시작 (${toTranslate.length}건, 7M ${newArticles.length - toTranslate.length}건 제외) ===\n`);
  for (let i = 0; i < toTranslate.length; i++) {
    const article = toTranslate[i] as AnalysisArticle;
    try {
      if (article.content) {
        article.content = await translateText(article.content);
      }
      if (article.prediction) {
        article.prediction = await translateText(article.prediction);
      }
      console.log(`  ✓ [${i + 1}/${toTranslate.length}] ${article.homeTeam} vs ${article.awayTeam}`);
    } catch (e) {
      console.error(`  ✗ [${i + 1}/${toTranslate.length}] ${article.homeTeam} vs ${article.awayTeam}: ${e}`);
    }
    // 요청 간 딜레이
    if (i < toTranslate.length - 1) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  console.log();

  // 이모지 제거 (번역 결과 + 7M/라이브맨 원문 포함 전체)
  newArticles.forEach((a) => {
    if (a.content) a.content = stripEmoji(a.content);
    if (a.prediction) a.prediction = stripEmoji(a.prediction);
  });

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
