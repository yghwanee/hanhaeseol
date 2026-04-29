import fs from "fs";
import path from "path";
import "dotenv/config";
import {
  registerFonts,
  getKstToday,
  loadTodayMatches,
  renderSportCard,
  renderOutroCard,
  sendTelegramMediaGroup,
  chunk,
  LAYOUT,
  SPORT_META,
  SPORTS_ORDER,
  type MediaItem,
} from "@/lib/instagram";
import { pickHookImage, renderHookV7 } from "@/lib/hook-card";

async function main() {
  registerFonts();
  const { today, mm, dd } = getKstToday();

  const items: MediaItem[] = [];
  const outDir = path.resolve("generated/instagram");
  fs.mkdirSync(outDir, { recursive: true });

  // 1) 메인 (V7 후킹 카드 + 매일 다른 AI 이미지)
  //    피드/스토리용은 PAD=50 (텍스트 크게), 릴스/쇼츠 첫 프레임은 PAD=85
  //    (영상 좌측 세이프존 회피). 두 파일 모두 디스크에 저장하되 캐러셀에는
  //    피드용만 포함. make-reel은 main-reel-* 을 골라 쓴다.
  {
    const hookImg = pickHookImage(today);
    const buf = await renderHookV7(hookImg, mm, dd, today);
    const filename = `main-${mm}${dd}.png`;
    fs.writeFileSync(path.join(outDir, filename), buf);
    items.push({ buf, filename, caption: `${mm}/${dd} 한해설 한국어 중계 편성표` });

    const reelBuf = await renderHookV7(hookImg, mm, dd, today, 85);
    fs.writeFileSync(path.join(outDir, `main-reel-${mm}${dd}.png`), reelBuf);
    console.log(`✅ 메인 (V7) — 피드용 + 릴스용`);
  }

  // 2) 종목별 (축구 → 야구 → 농구 → 배구)
  for (const sport of SPORTS_ORDER) {
    const meta = SPORT_META[sport];
    const matches = loadTodayMatches(sport, today);
    if (matches.length === 0) {
      console.log(`📭 ${sport}: 오늘 한국어 중계 없음`);
      continue;
    }
    const groups = chunk(matches, LAYOUT.matchesPerCard);
    for (let i = 0; i < groups.length; i++) {
      const buf = await renderSportCard(sport, groups[i], i, groups.length);
      const filename = `${meta.filePrefix}-${mm}${dd}${groups.length > 1 ? `-${i + 1}` : ""}.png`;
      fs.writeFileSync(path.join(outDir, filename), buf);
      items.push({ buf, filename });
    }
    console.log(`✅ ${sport} ${groups.length}장`);
  }

  // 3) 아웃트로
  {
    const buf = await renderOutroCard();
    const filename = "outro.png";
    fs.writeFileSync(path.join(outDir, filename), buf);
    items.push({ buf, filename });
    console.log(`✅ 아웃트로`);
  }

  console.log(`\n총 ${items.length}장 생성 완료`);

  const manifest = {
    date: `${mm}${dd}`,
    files: items.map((it) => it.filename),
  };
  fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  if (process.argv.includes("--no-send")) {
    console.log("📭 --no-send 옵션으로 텔레그램 전송 생략");
    return;
  }

  await sendTelegramMediaGroup(items);
  console.log(`✅ 텔레그램 앨범 전송 완료`);
}

main().catch((e) => {
  console.error("❌", e.message);
  process.exit(1);
});
