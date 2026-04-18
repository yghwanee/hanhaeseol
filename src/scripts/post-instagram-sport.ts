import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import fs from "fs";
import path from "path";
import "dotenv/config";
import type { Schedule, ScheduleData, Sport } from "@/types/schedule";

const LAYOUT = {
  startX: 85,
  startY: 540,
  blockHeight: 130,
  lineGap: 50,
  lineFontSize: 36,
  highlightColor: "#8fff3d",
  textColor: "#ffffff",
  matchesPerCard: 5,
};

const SPORT_META: Record<Sport, { emoji: string; template: string; filePrefix: string }> = {
  축구: { emoji: "⚽", template: "soccer-base.png", filePrefix: "soccer" },
  야구: { emoji: "⚾", template: "baseball-base.png", filePrefix: "baseball" },
  농구: { emoji: "🏀", template: "basketball-base.png", filePrefix: "basketball" },
  배구: { emoji: "🏐", template: "volleyball-base.png", filePrefix: "volleyball" },
};

const SPORT_ARG_MAP: Record<string, Sport> = {
  soccer: "축구",
  baseball: "야구",
  basketball: "농구",
  volleyball: "배구",
};

function getKstToday() {
  const kstStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" });
  const d = new Date(kstStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return { today: `${yyyy}-${mm}-${dd}`, mm, dd };
}

function loadTodayMatches(sport: Sport, today: string): Schedule[] {
  const data: ScheduleData = JSON.parse(
    fs.readFileSync(path.resolve("public/schedule.json"), "utf-8"),
  );
  return data.schedules
    .filter((s) => s.date === today && s.sport === sport && s.koreanCommentary === true)
    .sort((a, b) => a.time.localeCompare(b.time));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function drawMatchBlock(ctx: SKRSContext2D, match: Schedule, yTop: number) {
  const { startX, lineGap, lineFontSize, highlightColor, textColor } = LAYOUT;

  // 1줄: [시간 + 리그] 형광색
  const line1 = `${match.time} ${match.league}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 ${lineFontSize}px Pretendard`;
  ctx.fillStyle = highlightColor;
  ctx.fillText(line1, startX, yTop);

  // 2줄: [플랫폼] | [홈 VS 원정]
  const y2 = yTop + lineGap;
  let x = startX;
  const platformText = `${match.platform} | `;
  const homeText = match.homeTeam;
  const vsText = " VS ";
  const awayText = match.awayTeam;

  ctx.font = `500 ${lineFontSize}px Pretendard`;
  ctx.fillStyle = textColor;
  ctx.fillText(platformText, x, y2);
  x += ctx.measureText(platformText).width;

  ctx.fillText(homeText, x, y2);
  x += ctx.measureText(homeText).width;

  ctx.font = `700 ${lineFontSize}px Pretendard`;
  ctx.fillText(vsText, x, y2);
  x += ctx.measureText(vsText).width;

  ctx.font = `500 ${lineFontSize}px Pretendard`;
  ctx.fillText(awayText, x, y2);
}

async function renderCard(
  templatePath: string,
  matches: Schedule[],
  index: number,
  total: number,
): Promise<Buffer> {
  const template = await loadImage(templatePath);
  const canvas = createCanvas(template.width, template.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(template, 0, 0);

  matches.forEach((m, i) => {
    drawMatchBlock(ctx, m, LAYOUT.startY + i * LAYOUT.blockHeight);
  });

  if (total > 1) {
    ctx.font = "600 32px Pretendard";
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "right";
    ctx.fillText(`${index + 1} / ${total}`, template.width - 60, 60);
    ctx.textAlign = "left";
  }

  return canvas.toBuffer("image/png");
}

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
  GlobalFonts.registerFromPath(path.resolve("templates/fonts/Pretendard-Bold.otf"), "Pretendard");
  GlobalFonts.registerFromPath(path.resolve("templates/fonts/Pretendard-Medium.otf"), "Pretendard");
  GlobalFonts.registerFromPath(path.resolve("templates/fonts/Pretendard-Regular.otf"), "Pretendard");

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

  const templatePath = path.resolve("templates/instagram", meta.template);
  const outDir = path.resolve("generated/instagram");
  fs.mkdirSync(outDir, { recursive: true });

  const groups = chunk(matches, LAYOUT.matchesPerCard);

  for (let i = 0; i < groups.length; i++) {
    const buf = await renderCard(templatePath, groups[i], i, groups.length);
    const filename = `${meta.filePrefix}-${mm}${dd}${groups.length > 1 ? `-${i + 1}` : ""}.png`;
    const outPath = path.join(outDir, filename);
    fs.writeFileSync(outPath, buf);
    console.log(`✅ 이미지 생성: ${outPath}`);

    if (!skipSend) {
      const pageLabel = groups.length > 1 ? ` (${i + 1}/${groups.length})` : "";
      await sendTelegram(buf, `${meta.emoji} ${mm}/${dd} 한국어 ${sport} 중계${pageLabel}`, filename);
    }
  }

  if (skipSend) console.log("📭 --no-send 옵션으로 텔레그램 전송 생략");
  else console.log(`✅ 텔레그램 전송 완료 (${groups.length}장)`);
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
