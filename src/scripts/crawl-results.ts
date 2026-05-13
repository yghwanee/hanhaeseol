import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { crawlAllResults } from "@/lib/results/naver";

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
}

main().catch((err) => {
  console.error("결과 크롤링 실패:", err);
  process.exit(1);
});
