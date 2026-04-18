import { createCanvas, loadImage, GlobalFonts } from "@napi-rs/canvas";
import fs from "fs";
import path from "path";
import "dotenv/config";

// 날짜 텍스트 위치/크기 — 필요시 여기만 조정
const DATE_CONFIG = {
  fontSize: 260,
  x: 85,
  y: 1015, // baseline
  color: "#ffffff",
};

function getKstDate() {
  const kstStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" });
  const d = new Date(kstStr);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return { mm, dd };
}

async function generateImage(mm: string, dd: string): Promise<{ buf: Buffer; outPath: string }> {
  const fontPath = path.resolve("templates/fonts/Anton-Regular.ttf");
  const basePath = path.resolve("templates/instagram/main-base.png");

  GlobalFonts.registerFromPath(fontPath, "Anton");

  const template = await loadImage(basePath);
  const canvas = createCanvas(template.width, template.height);
  const ctx = canvas.getContext("2d");

  ctx.drawImage(template, 0, 0);

  ctx.fillStyle = DATE_CONFIG.color;
  ctx.font = `${DATE_CONFIG.fontSize}px Anton`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`${mm} / ${dd}`, DATE_CONFIG.x, DATE_CONFIG.y);

  const buf = canvas.toBuffer("image/png");
  const outDir = path.resolve("generated/instagram");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `main-${mm}${dd}.png`);
  fs.writeFileSync(outPath, buf);
  return { buf, outPath };
}

async function sendTelegram(buf: Buffer, mm: string, dd: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    throw new Error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 가 .env 에 없습니다");
  }

  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", `🏟 ${mm}/${dd} 한해설 메인 카드`);
  const uint8 = new Uint8Array(buf);
  form.append("photo", new Blob([uint8], { type: "image/png" }), `main-${mm}${dd}.png`);

  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    throw new Error(`Telegram 전송 실패: ${res.status} ${await res.text()}`);
  }
}

async function main() {
  const { mm, dd } = getKstDate();
  const { buf, outPath } = await generateImage(mm, dd);
  console.log(`✅ 이미지 생성: ${outPath}`);

  const skipSend = process.argv.includes("--no-send");
  if (skipSend) {
    console.log("📭 --no-send 옵션으로 텔레그램 전송 생략");
    return;
  }
  await sendTelegram(buf, mm, dd);
  console.log("✅ 텔레그램 전송 완료");
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
