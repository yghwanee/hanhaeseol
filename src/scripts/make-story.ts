import fs from "node:fs";
import path from "node:path";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { registerFonts } from "@/lib/instagram";
import { OUT_DIR, patchManifest, readManifest } from "@/lib/manifest";

const WIDTH = 1080;
const HEIGHT = 1920;
const SIDE_MARGIN = 60;
const OUTPUT = "story.png";

async function main() {
  registerFonts();

  const { files } = readManifest();
  const mainFile = files.find((f) => f.startsWith("main-"));
  if (!mainFile) throw new Error("메인 카드 없음");

  const main = await loadImage(path.join(OUT_DIR, mainFile));

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0a0a0a";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const cardW = WIDTH - SIDE_MARGIN * 2;
  const cardH = (main.height * cardW) / main.width;
  const cardX = SIDE_MARGIN;
  const cardY = Math.round((HEIGHT - cardH) / 2 - 80);
  ctx.drawImage(main, cardX, cardY, cardW, cardH);

  const ctaY = cardY + cardH + 140;
  ctx.textAlign = "center";

  ctx.fillStyle = "#8fff3d";
  ctx.font = "700 62px Pretendard";
  ctx.fillText("🔗 프로필 링크 확인", WIDTH / 2, ctaY);

  ctx.fillStyle = "#ffffff";
  ctx.font = "500 44px Pretendard";
  ctx.fillText("haeseol.com", WIDTH / 2, ctaY + 90);

  fs.writeFileSync(path.join(OUT_DIR, OUTPUT), canvas.toBuffer("image/png"));
  console.log(`✅ ${OUTPUT} 생성 완료`);

  patchManifest({ story: OUTPUT });
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
