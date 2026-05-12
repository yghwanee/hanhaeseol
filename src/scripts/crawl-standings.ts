import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fetchEplStandings, fetchKboStandings } from "@/lib/standings/naver";
import type { StandingsData } from "@/types/standings";

async function main() {
  console.log("순위 크롤링 시작");

  const [eplResult, kboResult] = await Promise.allSettled([
    fetchEplStandings(),
    fetchKboStandings(),
  ]);

  const epl =
    eplResult.status === "fulfilled" ? eplResult.value : null;
  const kbo =
    kboResult.status === "fulfilled" ? kboResult.value : null;

  if (eplResult.status === "rejected") {
    console.error("EPL 실패:", eplResult.reason);
  } else {
    console.log(`EPL: ${epl?.teams.length ?? 0}팀 (season=${epl?.season ?? "-"})`);
  }
  if (kboResult.status === "rejected") {
    console.error("KBO 실패:", kboResult.reason);
  } else {
    console.log(`KBO: ${kbo?.teams.length ?? 0}팀 (season=${kbo?.season ?? "-"})`);
  }

  const data: StandingsData = {
    epl,
    kbo,
    lastUpdated: new Date().toISOString(),
  };

  const jsonStr = JSON.stringify(data, null, 2);
  const srcPath = path.join(process.cwd(), "src/data/standings.json");
  const pubPath = path.join(process.cwd(), "public/standings.json");
  await fs.writeFile(srcPath, jsonStr, "utf-8");
  await fs.writeFile(pubPath, jsonStr, "utf-8");

  console.log(`완료 → ${srcPath}`);
}

main().catch((err) => {
  console.error("순위 크롤링 실패:", err);
  process.exit(1);
});
