import fs from "fs";
import path from "path";
import "dotenv/config";
import {
  registerFonts,
  getKstToday,
  loadTodayMatches,
  renderSportCard,
  sendTelegramPhoto,
  chunk,
  LAYOUT,
  SPORT_META,
  SPORT_ARG_MAP,
} from "@/lib/instagram";

async function main() {
  registerFonts();

  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const skipSend = process.argv.includes("--no-send");
  const sportArg = args[0];
  if (!sportArg || !SPORT_ARG_MAP[sportArg]) {
    console.error("❌ 종목 필수: soccer | baseball | basketball | volleyball");
    process.exit(1);
  }
  const sport = SPORT_ARG_MAP[sportArg];
  const meta = SPORT_META[sport];

  const { today, mm, dd } = getKstToday();
  const matches = loadTodayMatches(sport, today);
  if (matches.length === 0) {
    console.log(`📭 오늘 한국어 중계 ${sport} 경기 없음`);
    return;
  }

  const groups = chunk(matches, LAYOUT.matchesPerCard);
  const outDir = path.resolve("generated/instagram");
  fs.mkdirSync(outDir, { recursive: true });

  for (let i = 0; i < groups.length; i++) {
    const buf = await renderSportCard(sport, groups[i], i, groups.length);
    const filename = `${meta.filePrefix}-${mm}${dd}${groups.length > 1 ? `-${i + 1}` : ""}.png`;
    const outPath = path.join(outDir, filename);
    fs.writeFileSync(outPath, buf);
    console.log(`✅ 이미지 생성: ${outPath}`);

    if (!skipSend) {
      const pageLabel = groups.length > 1 ? ` (${i + 1}/${groups.length})` : "";
      await sendTelegramPhoto(
        buf,
        `${meta.emoji} ${mm}/${dd} 한국어 ${sport} 중계${pageLabel}`,
        filename,
      );
    }
  }

  if (skipSend) console.log("📭 --no-send 옵션으로 텔레그램 전송 생략");
  else console.log(`✅ 텔레그램 전송 완료 (${groups.length}장)`);
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
