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
import { pickHookImage } from "@/lib/hook-card";
import { renderReelTitleCard } from "@/lib/reel-title-card";
import { getPostSlot } from "@/lib/post-slot";

// morning 워크플로우가 HHS_LEGACY_MORNING=1 을 세팅한다.
// 2026-08-05 부터 커버 디자인은 두 슬롯이 같고(슬롯별 액센트·배치로 갈린다),
// 이 플래그는 "릴스 v1 이 첫 프레임으로 쓸 9:16 을 하나 더 만드는가"만 정한다.
const LEGACY_MORNING = process.env.HHS_LEGACY_MORNING === "1";

async function main() {
  registerFonts();
  const { today, mm, dd } = getKstToday();

  const items: MediaItem[] = [];
  const outDir = path.resolve("generated/instagram");
  fs.mkdirSync(outDir, { recursive: true });

  // 1) 메인 — 두 슬롯 모두 reel-title-card 4:5.
  //    슬롯별 액센트(아침 앰버 / 저녁 라임)와 배치(아침 작은줄→큰줄 / 저녁 큰줄→설명줄)가
  //    갈리므로 레이아웃을 통일해도 두 게시물이 같은 그림이 되지 않는다.
  //    아침(LEGACY_MORNING)은 릴스 v1 이 첫 프레임으로 쓰는 9:16 을 하나 더 만든다.
  {
    const slot = getPostSlot(today);
    const hookImg = pickHookImage(today, slot);
    const filename = `main-${mm}${dd}.png`;

    const buf = await renderReelTitleCard(hookImg, today, "4:5", { slot });
    fs.writeFileSync(path.join(outDir, filename), buf);
    items.push({ buf, filename, caption: `${mm}/${dd} 한해설 한국어 중계 편성표` });

    if (LEGACY_MORNING) {
      const reelBuf = await renderReelTitleCard(hookImg, today, "9:16", { slot });
      fs.writeFileSync(path.join(outDir, `main-reel-${mm}${dd}.png`), reelBuf);
      console.log(`✅ 메인 (reel-title 4:5 + 9:16) — 캐러셀 + 릴스 v1 첫 프레임`);
    } else {
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
