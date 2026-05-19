import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { crawlAllResults } from "@/lib/results/naver";
import type { MatchResult, ResultsData } from "@/types/results";
import { resultKey } from "@/lib/results/lookup";

async function main() {
  console.log("결과 크롤링 시작 (네이버 스포츠, 어제~내일 3일치)");

  const data = await crawlAllResults();

  // 안전장치: 모든 호출이 실패해 0건이면 기존 파일을 덮어쓰지 않는다.
  // 네이버가 일시적으로 5xx/403 응답하는 경우 기존 데이터 유지가 빈 데이터로 덮는 것보다 낫다.
  if (data.results.length === 0) {
    console.error("결과 0건 — 일시적 차단 가능성. 기존 results.json을 유지하고 종료.");
    process.exit(1);
  }

  const json = JSON.stringify(data, null, 2);
  const srcPath = path.join(process.cwd(), "src/data/results.json");
  const pubPath = path.join(process.cwd(), "public/results.json");
  await fs.writeFile(srcPath, json, "utf-8");
  await fs.writeFile(pubPath, json, "utf-8");

  const finished = data.results.filter((r) => r.status === "finished").length;
  const live = data.results.filter((r) => r.status === "live").length;
  console.log(
    `완료 → ${srcPath}\n  전체 ${data.results.length}건 (종료 ${finished} / 라이브 ${live})`,
  );

  // results-archive.json 영구 누적: finished/canceled만 (live/scheduled/postponed는 변동 가능).
  // /match/[slug]에서 종료 경기 페이지의 스코어 표시 + Google이 영구 가치 있는 페이지로 인식하게 만듦.
  const archivePath = path.join(process.cwd(), "src/data/results-archive.json");
  const archivePublicPath = path.join(process.cwd(), "public/results-archive.json");
  let archive: ResultsData = {
    lastUpdated: "",
    byKey: {},
    results: [],
  };
  try {
    archive = JSON.parse(await fs.readFile(archivePath, "utf-8"));
  } catch {
    // 파일 없으면 새로 시작
  }

  // 누적 키: date|categoryId|homeTeam|awayTeam — 같은 경기는 최신 결과로 덮어쓰기
  const dedupKey = (r: MatchResult) =>
    `${r.date}|${r.categoryId}|${r.homeTeam}|${r.awayTeam}`;
  const acc = new Map<string, MatchResult>();
  for (const r of archive.results) acc.set(dedupKey(r), r);

  let added = 0;
  for (const r of data.results) {
    if (r.status !== "finished" && r.status !== "canceled") continue;
    const k = dedupKey(r);
    if (!acc.has(k)) added++;
    acc.set(k, r);
  }

  const archivedResults = [...acc.values()].sort((a, b) =>
    a.date === b.date ? a.categoryId.localeCompare(b.categoryId) : a.date.localeCompare(b.date),
  );

  // byKey는 lookup용. crawler가 alias 변형까지 채워주지만, archive 누적 단계에서는
  // 1차 표기만 keying. 매치 페이지에서 findResult가 alias 처리하므로 충분.
  const archiveByKey: Record<string, MatchResult> = {};
  for (const r of archivedResults) {
    archiveByKey[resultKey(r.date, r.categoryId, r.homeTeam, r.awayTeam)] = r;
  }

  const newArchive: ResultsData = {
    lastUpdated: new Date().toISOString(),
    byKey: archiveByKey,
    results: archivedResults,
  };
  const archiveJson = JSON.stringify(newArchive, null, 2);
  await fs.writeFile(archivePath, archiveJson, "utf-8");
  // public에도 저장 → 메인 페이지 datepicker로 과거 날짜 조회 시 클라이언트가 fetch.
  await fs.writeFile(archivePublicPath, archiveJson, "utf-8");
  console.log(
    `archive: 총 ${archivedResults.length}건 (신규 ${added}건)`,
  );
}

main().catch((err) => {
  console.error("결과 크롤링 실패:", err);
  process.exit(1);
});
