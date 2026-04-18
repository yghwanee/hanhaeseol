import fs from "node:fs";
import path from "node:path";
import { sendTelegramMediaGroup, type MediaItem } from "@/lib/instagram";

const FAIL_TEXT = "❌ 인스타 카드 생성/게시 실패. GitHub Actions 로그 확인.";
const FAIL_CAPTION = "❌ 인스타 게시 실패. 아래 카드를 수동으로 업로드해주세요.";

async function sendText(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 없음");

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) throw new Error(`Telegram 텍스트 전송 실패: ${res.status} ${await res.text()}`);
}

async function main() {
  const outDir = path.resolve("generated/instagram");
  const manifestPath = path.join(outDir, "manifest.json");

  if (!fs.existsSync(manifestPath)) {
    await sendText(FAIL_TEXT);
    return;
  }

  const { files } = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { files: string[] };
  if (files.length === 0) {
    await sendText(FAIL_TEXT);
    return;
  }

  const items: MediaItem[] = files.map((filename, i) => ({
    buf: fs.readFileSync(path.join(outDir, filename)),
    filename,
    caption: i === 0 ? FAIL_CAPTION : undefined,
  }));

  await sendTelegramMediaGroup(items);
  console.log(`✅ 실패 알림 + 카드 ${items.length}장 텔레그램 전송 완료`);
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
