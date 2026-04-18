import fs from "fs";
import path from "path";
import "dotenv/config";

async function sendTelegram(buf: Buffer, caption: string, filename: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 가 .env 에 없습니다");

  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", caption);
  const uint8 = new Uint8Array(buf);
  form.append("photo", new Blob([uint8], { type: "image/png" }), filename);

  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`Telegram 전송 실패: ${res.status} ${await res.text()}`);
}

async function main() {
  const buf = fs.readFileSync(path.resolve("templates/instagram/outro.png"));
  console.log("✅ 아웃트로 이미지 로드");

  const skipSend = process.argv.includes("--no-send");
  if (skipSend) {
    console.log("📭 --no-send 옵션으로 텔레그램 전송 생략");
    return;
  }
  await sendTelegram(buf, "📌 한해설 - 한국어 해설 편성표", "outro.png");
  console.log("✅ 텔레그램 전송 완료");
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
