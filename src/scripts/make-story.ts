import fs from "node:fs";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { registerFonts } from "@/lib/instagram";

const WIDTH = 1080;
const HEIGHT = 1920;
const SIDE_MARGIN = 60;

async function main() {
  registerFonts();

  const outDir = path.resolve("generated/instagram");
  const manifestPath = path.join(outDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new Error("manifest.json 없음 — 먼저 post:all 실행 필요");

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { files: string[] };
  const mainFile = manifest.files.find((f) => f.startsWith("main-"));
  if (!mainFile) throw new Error("메인 카드 없음");

  const main = await loadImage(path.join(outDir, mainFile));

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  // 배경
  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 메인 카드를 가로 폭에 맞춰 스케일, 세로 약간 위쪽으로 배치
  const cardW = WIDTH - SIDE_MARGIN * 2;
  const cardH = (main.height * cardW) / main.width;
  const cardX = SIDE_MARGIN;
  const cardY = Math.round((HEIGHT - cardH) / 2 - 80);
  ctx.drawImage(main, cardX, cardY, cardW, cardH);

  // 하단 CTA
  const ctaY = cardY + cardH + 140;
  ctx.textAlign = "center";

  ctx.fillStyle = "#8fff3d";
  ctx.font = "700 62px Pretendard";
  ctx.fillText("🔗 프로필 링크 확인", WIDTH / 2, ctaY);

  ctx.fillStyle = "#ffffff";
  ctx.font = "500 44px Pretendard";
  ctx.fillText("haeseol.com", WIDTH / 2, ctaY + 90);

  const out = path.join(outDir, "story.png");
  fs.writeFileSync(out, canvas.toBuffer("image/png"));
  console.log(`✅ story.png 생성 완료`);

  const updated = { ...manifest, story: "story.png" };
  fs.writeFileSync(manifestPath, JSON.stringify(updated, null, 2));
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
