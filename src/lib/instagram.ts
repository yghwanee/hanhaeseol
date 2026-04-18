import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import fs from "fs";
import path from "path";
import type { Schedule, ScheduleData, Sport } from "@/types/schedule";

export const LAYOUT = {
  startX: 85,
  startY: 540,
  blockHeight: 130,
  lineGap: 50,
  lineFontSize: 36,
  highlightColor: "#8fff3d",
  textColor: "#ffffff",
  matchesPerCard: 5,
};

export const MAIN_DATE_CONFIG = {
  fontSize: 260,
  x: 85,
  y: 1015,
  color: "#ffffff",
};

export const SPORT_META: Record<Sport, { emoji: string; template: string; filePrefix: string }> = {
  축구: { emoji: "⚽", template: "soccer-base.png", filePrefix: "soccer" },
  야구: { emoji: "⚾", template: "baseball-base.png", filePrefix: "baseball" },
  농구: { emoji: "🏀", template: "basketball-base.png", filePrefix: "basketball" },
  배구: { emoji: "🏐", template: "volleyball-base.png", filePrefix: "volleyball" },
};

export const SPORT_ARG_MAP: Record<string, Sport> = {
  soccer: "축구",
  baseball: "야구",
  basketball: "농구",
  volleyball: "배구",
};

export const SPORTS_ORDER: Sport[] = ["축구", "야구", "농구", "배구"];

export function registerFonts() {
  GlobalFonts.registerFromPath(path.resolve("templates/fonts/Anton-Regular.ttf"), "Anton");
  GlobalFonts.registerFromPath(path.resolve("templates/fonts/Pretendard-Bold.otf"), "Pretendard");
  GlobalFonts.registerFromPath(path.resolve("templates/fonts/Pretendard-Medium.otf"), "Pretendard");
  GlobalFonts.registerFromPath(path.resolve("templates/fonts/Pretendard-Regular.otf"), "Pretendard");
}

export function getKstToday() {
  const kstStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" });
  const d = new Date(kstStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return { today: `${yyyy}-${mm}-${dd}`, mm, dd };
}

export function loadTodayMatches(sport: Sport, today: string): Schedule[] {
  const data: ScheduleData = JSON.parse(
    fs.readFileSync(path.resolve("public/schedule.json"), "utf-8"),
  );
  return data.schedules
    .filter((s) => s.date === today && s.sport === sport && s.koreanCommentary === true)
    .sort((a, b) => a.time.localeCompare(b.time));
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function drawMatchBlock(ctx: SKRSContext2D, match: Schedule, yTop: number) {
  const { startX, lineGap, lineFontSize, highlightColor, textColor } = LAYOUT;

  const line1 = `${match.time} ${match.league}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 ${lineFontSize}px Pretendard`;
  ctx.fillStyle = highlightColor;
  ctx.fillText(line1, startX, yTop);

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

export async function renderMainCard(mm: string, dd: string): Promise<Buffer> {
  const template = await loadImage(path.resolve("templates/instagram/main-base.png"));
  const canvas = createCanvas(template.width, template.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(template, 0, 0);

  ctx.fillStyle = MAIN_DATE_CONFIG.color;
  ctx.font = `${MAIN_DATE_CONFIG.fontSize}px Anton`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillText(`${mm} / ${dd}`, MAIN_DATE_CONFIG.x, MAIN_DATE_CONFIG.y);

  return canvas.toBuffer("image/png");
}

export async function renderSportCard(
  sport: Sport,
  matches: Schedule[],
  index: number,
  total: number,
): Promise<Buffer> {
  const meta = SPORT_META[sport];
  const templatePath = path.resolve("templates/instagram", meta.template);
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

export function readOutroCard(): Buffer {
  return fs.readFileSync(path.resolve("templates/instagram/outro.png"));
}

export async function sendTelegramPhoto(buf: Buffer, caption: string, filename: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 가 .env 에 없습니다");

  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("caption", caption);
  form.append("photo", new Blob([new Uint8Array(buf)], { type: "image/png" }), filename);

  const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`Telegram 전송 실패: ${res.status} ${await res.text()}`);
}

export interface MediaItem {
  buf: Buffer;
  filename: string;
  caption?: string;
}

/** 최대 10장씩 앨범(미디어 그룹)으로 전송. 첫 미디어에 caption 있으면 앨범 전체 caption이 됨. */
export async function sendTelegramMediaGroup(items: MediaItem[]) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 가 .env 에 없습니다");

  const batches = chunk(items, 10);
  for (const batch of batches) {
    const form = new FormData();
    form.append("chat_id", chatId);

    const media = batch.map((it, i) => {
      const entry: { type: string; media: string; caption?: string } = {
        type: "photo",
        media: `attach://file${i}`,
      };
      if (it.caption) entry.caption = it.caption;
      return entry;
    });
    form.append("media", JSON.stringify(media));

    batch.forEach((it, i) => {
      form.append(`file${i}`, new Blob([new Uint8Array(it.buf)], { type: "image/png" }), it.filename);
    });

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMediaGroup`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error(`Telegram MediaGroup 전송 실패: ${res.status} ${await res.text()}`);
  }
}
