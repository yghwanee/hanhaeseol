import "dotenv/config";
import { readOutroCard, sendTelegramPhoto } from "@/lib/instagram";

async function main() {
  const buf = readOutroCard();
  console.log("✅ 아웃트로 이미지 로드");

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
