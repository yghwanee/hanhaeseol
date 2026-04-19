import fs from "node:fs";
import path from "node:path";
import {
  sendTelegramDocument,
  sendTelegramMediaGroup,
  type MediaItem,
} from "@/lib/instagram";
import { MANIFEST_PATH, OUT_DIR, readManifest } from "@/lib/manifest";

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
  if (!fs.existsSync(MANIFEST_PATH)) {
    await sendText(FAIL_TEXT);
    return;
  }

  const manifest = readManifest();
  const { files, reel, story } = manifest;
  if (files.length === 0) {
    await sendText(FAIL_TEXT);
    return;
  }

  const items: MediaItem[] = files.map((filename, i) => ({
    buf: fs.readFileSync(path.join(OUT_DIR, filename)),
    filename,
    caption: i === 0 ? FAIL_CAPTION : undefined,
  }));

  await sendTelegramMediaGroup(items);
  console.log(`✅ 카드 ${items.length}장 전송 완료`);

  if (reel) {
    const reelPath = path.join(OUT_DIR, reel);
    if (fs.existsSync(reelPath)) {
      // 원본 품질 보존을 위해 document로 전송 (sendVideo는 Telegram이 재압축함)
      await sendTelegramDocument(fs.readFileSync(reelPath), reel, "🎬 릴스 영상 (원본)");
      console.log(`✅ 릴스 ${reel} 전송 완료`);
    }
  }

  if (story) {
    const storyPath = path.join(OUT_DIR, story);
    if (fs.existsSync(storyPath)) {
      await sendTelegramDocument(fs.readFileSync(storyPath), story, "📱 스토리 이미지 (원본)");
      console.log(`✅ 스토리 ${story} 전송 완료`);
    }
  }
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
