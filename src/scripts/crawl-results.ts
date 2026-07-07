import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { crawlAllResults, SOCCER_CATEGORIES } from "@/lib/results/naver";
import type { MatchResult, ResultsData } from "@/types/results";
import { resultKey } from "@/lib/results/lookup";
import { searchHighlightVideoId, highlightChannelFor } from "@/lib/highlights/youtube";

/**
 * 종료된 경기에 유튜브 하이라이트 영상ID를 부여한다.
 * 대상: 축구 전체 + 공식 채널 매핑이 있는 리그(KBO·MLB — highlightChannelFor).
 * 아카이브에 이미 있으면 재사용(쿼터 절약), 없으면 크롤마다 재검색 —
 * 공식 채널 업로드가 경기 종료보다 늦으므로 "올라올 때까지 재시도"가 의도된 동작.
 * search.list는 호출당 쿼터 100(일 10,000)이라 런당 검색 수를 캡해 쿼터 고갈을 막는다.
 * YOUTUBE_API_KEY 미설정 시 전부 건너뜀(no-op).
 */
const HIGHLIGHT_SEARCH_CAP_PER_RUN = 25;

async function enrichHighlights(
  results: MatchResult[],
  archive: ResultsData,
  dedupKey: (r: MatchResult) => string,
): Promise<void> {
  if (!process.env.YOUTUBE_API_KEY) return;
  const prev = new Map<string, string>();
  for (const r of archive.results) {
    if (r.highlightVideoId) prev.set(dedupKey(r), r.highlightVideoId);
  }
  let searched = 0;
  let found = 0;
  for (const r of results) {
    if (r.status !== "finished") continue;
    if (!SOCCER_CATEGORIES.has(r.categoryId) && !highlightChannelFor(r.categoryId)) continue;
    const existing = prev.get(dedupKey(r));
    if (existing) {
      r.highlightVideoId = existing;
      continue;
    }
    if (searched >= HIGHLIGHT_SEARCH_CAP_PER_RUN) continue;
    searched++;
    const id = await searchHighlightVideoId(r.homeTeam, r.awayTeam, r.categoryId, r.date);
    if (id) {
      r.highlightVideoId = id;
      found++;
    }
  }
  if (searched > 0) console.log(`  하이라이트: 검색 ${searched}건, 신규 ${found}건`);
}

async function main() {
  console.log("결과 크롤링 시작 (네이버 스포츠, 어제~내일 3일치)");

  const data = await crawlAllResults();

  // 안전장치: 모든 호출이 실패해 0건이면 기존 파일을 덮어쓰지 않는다.
  // 네이버가 일시적으로 5xx/403 응답하는 경우 기존 데이터 유지가 빈 데이터로 덮는 것보다 낫다.
  if (data.results.length === 0) {
    console.error("결과 0건 — 일시적 차단 가능성. 기존 results.json을 유지하고 종료.");
    process.exit(1);
  }

  // 아카이브를 먼저 읽어 ①하이라이트 영상ID 이월 ②아래 누적 단계에 재사용.
  const archivePath = path.join(process.cwd(), "src/data/results-archive.json");
  const archivePublicPath = path.join(process.cwd(), "public/results-archive.json");
  let archive: ResultsData = { lastUpdated: "", byKey: {}, results: [] };
  try {
    archive = JSON.parse(await fs.readFile(archivePath, "utf-8"));
  } catch {
    // 파일 없으면 새로 시작
  }

  // 누적 키: date|categoryId|homeTeam|awayTeam — 같은 경기는 최신 결과로 덮어쓰기
  const dedupKey = (r: MatchResult) =>
    `${r.date}|${r.categoryId}|${r.homeTeam}|${r.awayTeam}`;

  // 종료 축구 경기에 유튜브 하이라이트 영상ID 부여(검색은 결과 객체를 직접 수정 → byKey에도 반영).
  await enrichHighlights(data.results, archive, dedupKey);

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
  // archive / dedupKey 는 위 하이라이트 이월 단계에서 이미 로드/정의됨.
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
