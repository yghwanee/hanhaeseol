import "dotenv/config";
import fs from "fs";
import path from "path";
import { registerFonts, renderOutroCard, sendTelegramPhoto } from "@/lib/instagram";

async function main() {
  registerFonts();
  const buf = await renderOutroCard();
  const outDir = path.resolve("generated/instagram");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "outro.png"), buf);
  console.log("✅ 아웃트로 이미지 생성");

  if (process.argv.includes("--no-send")) {
    console.log("📭 --no-send 옵션으로 텔레그램 전송 생략");
    return;
  }
  await sendTelegramPhoto(buf, "📌 한해설 - 한국어 해설 편성표", "outro.png");
  console.log("✅ 텔레그램 전송 완료");
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
