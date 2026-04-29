import fs from "fs";
import path from "path";
import "dotenv/config";
import {
  registerFonts,
  getKstToday,
  sendTelegramMediaGroup,
  type MediaItem,
} from "@/lib/instagram";
import { HOOK_VARIANTS } from "@/lib/hook-card";

async function main() {
  registerFonts();
  const { today, mm, dd } = getKstToday();

  const imageArg = process.argv.find((a) => a.startsWith("--image="));
  const imagePath = imageArg
    ? imageArg.replace("--image=", "")
    : path.resolve("templates/instagram/hooks/sample-01.jpg");

  if (!fs.existsSync(imagePath)) {
    throw new Error(`이미지 파일을 찾을 수 없습니다: ${imagePath}`);
  }

  const outDir = path.resolve("generated/instagram/hooks");
  fs.mkdirSync(outDir, { recursive: true });

  const items: MediaItem[] = [];
  for (const variant of HOOK_VARIANTS) {
    const buf = await variant.fn(imagePath, mm, dd, today);
    const filename = `hook-${variant.name}-${mm}${dd}.png`;
    fs.writeFileSync(path.join(outDir, filename), buf);
    items.push({ buf, filename, caption: `${variant.name} — ${variant.label}` });
    console.log(`✅ ${variant.name} ${variant.label}`);
  }

  console.log(`\n총 ${items.length}장 생성 → ${outDir}`);

  if (process.argv.includes("--no-send")) {
    console.log("📭 --no-send 옵션으로 텔레그램 전송 생략");
    return;
  }

  await sendTelegramMediaGroup(items);
  console.log("✅ 텔레그램 앨범 전송 완료");
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
