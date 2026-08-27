import fs from "node:fs";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { registerFonts } from "@/lib/instagram";

const WIDTH = 1200;
const HEIGHT = 630;
const OUTPUT = path.resolve("public/og-default.png");
const LOGO = path.resolve("assets/logo.png");

async function main() {
  registerFonts();

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  const bg = ctx.createRadialGradient(WIDTH * 0.25, HEIGHT * 0.2, 0, WIDTH * 0.5, HEIGHT * 0.5, WIDTH * 0.9);
  bg.addColorStop(0, "#1e1b3a");
  bg.addColorStop(0.55, "#0a0a0a");
  bg.addColorStop(1, "#000000");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.strokeStyle = "rgba(168, 85, 247, 0.18)";
  ctx.lineWidth = 1;
  for (let y = 0; y < HEIGHT; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }

  const logo = await loadImage(LOGO);
  const logoSize = 110;
  const logoX = (WIDTH - logoSize) / 2;
  const logoY = 50;
  ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);

  ctx.fillStyle = "#ffffff";
  ctx.font = "900 160px Pretendard";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("한해설", WIDTH / 2, 340);

  ctx.fillStyle = "#d4d4d8";
  ctx.font = "600 42px Pretendard";
  ctx.fillText("스포츠 한국어해설 편성표", WIDTH / 2, 405);

  const badgeText = "한국어해설";
  ctx.font = "700 36px Pretendard";
  const badgeMetrics = ctx.measureText(badgeText);
  const badgeW = Math.round(badgeMetrics.width) + 64;
  const badgeH = 68;
  const badgeX = Math.round((WIDTH - badgeW) / 2);
  const badgeY = 460;

  ctx.fillStyle = "rgba(34, 197, 94, 0.14)";
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 9999);
  ctx.fill();
  ctx.strokeStyle = "#22c55e";
  ctx.lineWidth = 2.5;
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 9999);
  ctx.stroke();

  ctx.fillStyle = "#4ade80";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const ascent = badgeMetrics.actualBoundingBoxAscent;
  const descent = badgeMetrics.actualBoundingBoxDescent;
  const badgeBaselineY = badgeY + badgeH / 2 + (ascent - descent) / 2;
  ctx.fillText(badgeText, WIDTH / 2, badgeBaselineY);

  ctx.fillStyle = "#71717a";
  ctx.font = "600 26px Pretendard";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("haeseol.com", WIDTH / 2, 590);

  fs.writeFileSync(OUTPUT, canvas.toBuffer("image/png"));
  console.log(`✅ OG 이미지 생성: ${OUTPUT} (${WIDTH}×${HEIGHT})`);
}

function roundRect(
  ctx: ReturnType<ReturnType<typeof createCanvas>["getContext"]>,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
