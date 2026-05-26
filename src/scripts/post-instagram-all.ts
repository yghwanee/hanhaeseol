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
import { renderReelTitleCard } from "@/lib/reel-title-card";

// morning 워크플로우는 HHS_LEGACY_MORNING=1을 세팅해서 캐러셀 1번 슬라이드를
// V7 후킹 카드(좌측 다크 패널)로 만든다. 저녁(신규) 게시물과 시각적으로
// 구별되도록 — 같은 날 2번 올려도 다른 컨텐츠처럼 보이게.
const LEGACY_MORNING = process.env.HHS_LEGACY_MORNING === "1";

async function main() {
  registerFonts();
  const { today, mm, dd } = getKstToday();

  const items: MediaItem[] = [];
  const outDir = path.resolve("generated/instagram");
  fs.mkdirSync(outDir, { recursive: true });

  // 1) 메인
  //    - LEGACY_MORNING=1 (morning): V7 후킹 카드 (좌측 다크 패널) + 릴스 세이프존용 변형(pad=85).
  //      make-reel.ts(v1)가 main-reel-* 을 첫 프레임으로 사용.
  //    - 기본 (evening, v2): reel-title-card 4:5 — 캐러셀 1번 = 릴스 cover_url 공용.
  {
    const hookImg = pickHookImage(today);
    const filename = `main-${mm}${dd}.png`;
    if (LEGACY_MORNING) {
      const buf = await renderHookV7(hookImg, mm, dd, today);
      fs.writeFileSync(path.join(outDir, filename), buf);
      items.push({ buf, filename, caption: `${mm}/${dd} 한해설 한국어 중계 편성표` });

      const reelBuf = await renderHookV7(hookImg, mm, dd, today, 85);
      fs.writeFileSync(path.join(outDir, `main-reel-${mm}${dd}.png`), reelBuf);
      console.log(`✅ 메인 (V7 legacy) — 피드용 + 릴스용`);
    } else {
      const buf = await renderReelTitleCard(hookImg, today, "4:5");
      fs.writeFileSync(path.join(outDir, filename), buf);
      items.push({ buf, filename, caption: `${mm}/${dd} 한해설 한국어 중계 편성표` });
      console.log(`✅ 메인 (reel-title 4:5) — 캐러셀 + 릴스 cover 공용`);
    }
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
