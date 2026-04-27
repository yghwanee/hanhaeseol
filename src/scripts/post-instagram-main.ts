import fs from "fs";
import path from "path";
import "dotenv/config";
import {
  registerFonts,
  getKstToday,
  renderMainCard,
  sendTelegramPhoto,
} from "@/lib/instagram";

async function main() {
  registerFonts();
  const { today, mm, dd } = getKstToday();
  const buf = await renderMainCard(mm, dd, today);

  const outDir = path.resolve("generated/instagram");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `main-${mm}${dd}.png`);
  fs.writeFileSync(outPath, buf);
  console.log(`✅ 이미지 생성: ${outPath}`);

  if (process.argv.includes("--no-send")) {
    console.log("📭 --no-send 옵션으로 텔레그램 전송 생략");
    return;
  }
  await sendTelegramPhoto(buf, `🏟 ${mm}/${dd} 한해설 메인 카드`, `main-${mm}${dd}.png`);
  console.log("✅ 텔레그램 전송 완료");
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
