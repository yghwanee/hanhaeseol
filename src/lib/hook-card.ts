import fs from "fs";
import path from "path";
import { createCanvas, loadImage, type SKRSContext2D, type Image } from "@napi-rs/canvas";
import {
  MAIN_CARD_SIZE,
  fetchTeamLogoImage,
  loadKoreanMatchesAll,
  loadAllMatchesForDate,
  pickHeroMatch,
  fitText,
} from "./instagram";
import { findEnglishTeamName } from "@/data/team-names";

const ACCENT = "#8fff3d";
const DARK_BG = "#08080d";
const KST_DOW = ["일", "월", "화", "수", "목", "금", "토"];

function dayOfWeekKr(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return KST_DOW[dt.getUTCDay()];
}

function drawCover(
  ctx: SKRSContext2D,
  img: Image,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  focusY = 0.4,
) {
  const targetRatio = dw / dh;
  const srcRatio = img.width / img.height;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (srcRatio > targetRatio) {
    sw = img.height * targetRatio;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / targetRatio;
    sy = (img.height - sh) * focusY;
  }
  ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

function drawTextWithShadow(
  ctx: SKRSContext2D,
  text: string,
  x: number,
  y: number,
  shadowBlur = 18,
  shadowAlpha = 0.45,
) {
  ctx.save();
  ctx.shadowColor = `rgba(0,0,0,${shadowAlpha})`;
  ctx.shadowBlur = shadowBlur;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawBrandMark(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  color = "#ffffff",
  size = 28,
) {
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = ACCENT;
  ctx.fillRect(x, y - size + 2, 4, size);
  ctx.fillStyle = color;
  ctx.font = `800 ${size}px Pretendard`;
  ctx.fillText("HAESEOL", x + 14, y);
  ctx.restore();
}

/** V1: 좌측 빈공간에 거대 화이트 날짜 + 그림자 (이미지 자연 톤 유지) */
export async function renderHookV1(imagePath: string, mm: string, dd: string, today: string): Promise<Buffer> {
  const W = MAIN_CARD_SIZE.width;
  const H = MAIN_CARD_SIZE.height;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const img = await loadImage(imagePath);
  drawCover(ctx, img, 0, 0, W, H, 0.35);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  ctx.fillStyle = "#ffffff";
  ctx.font = "260px Anton";
  drawTextWithShadow(ctx, mm, 70, 360, 22, 0.35);
  ctx.fillStyle = ACCENT;
  drawTextWithShadow(ctx, "/", 70, 590, 22, 0.35);
  ctx.fillStyle = "#ffffff";
  drawTextWithShadow(ctx, dd, 70, 820, 22, 0.35);

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "700 38px Pretendard";
  drawTextWithShadow(ctx, `${dayOfWeekKr(today)}요일`, 70, 880, 12, 0.35);

  drawBrandMark(ctx, 70, 100, "#ffffff", 30);

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "800 36px Pretendard";
  drawTextWithShadow(ctx, "haeseol.com →", 70, H - 70, 14, 0.4);

  return canvas.toBuffer("image/png");
}

/** V2: 하단 다크 글래스 페이드 + 거대 날짜 가로 배치 */
export async function renderHookV2(imagePath: string, mm: string, dd: string, today: string): Promise<Buffer> {
  const W = MAIN_CARD_SIZE.width;
  const H = MAIN_CARD_SIZE.height;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const img = await loadImage(imagePath);
  drawCover(ctx, img, 0, 0, W, H, 0.3);

  const fadeStart = 720;
  const fade = ctx.createLinearGradient(0, fadeStart, 0, H);
  fade.addColorStop(0, "rgba(8,8,13,0)");
  fade.addColorStop(0.4, "rgba(8,8,13,0.65)");
  fade.addColorStop(1, "rgba(8,8,13,0.96)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, fadeStart, W, H - fadeStart);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  drawBrandMark(ctx, 70, 100, "#ffffff", 30);

  ctx.fillStyle = "#ffffff";
  ctx.font = "240px Anton";
  ctx.fillText(mm, 70, 1170);
  const mmW = ctx.measureText(mm).width;
  ctx.fillStyle = ACCENT;
  ctx.fillText("/", 70 + mmW + 16, 1170);
  const slashW = ctx.measureText("/").width;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(dd, 70 + mmW + 16 + slashW + 16, 1170);

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "600 32px Pretendard";
  ctx.fillText(`${dayOfWeekKr(today)}요일`, 70, 1015);

  ctx.fillStyle = ACCENT;
  ctx.font = "800 38px Pretendard";
  ctx.fillText("haeseol.com →", 70, H - 60);

  return canvas.toBuffer("image/png");
}

/** V3: 좌측 35% 다크 사이드 패널 (정보) + 우측 65% 이미지 */
export async function renderHookV3(imagePath: string, mm: string, dd: string, today: string): Promise<Buffer> {
  const W = MAIN_CARD_SIZE.width;
  const H = MAIN_CARD_SIZE.height;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const splitX = Math.round(W * 0.38);

  const img = await loadImage(imagePath);
  drawCover(ctx, img, splitX, 0, W - splitX, H, 0.35);

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#08080d");
  bg.addColorStop(0.6, "#11111e");
  bg.addColorStop(1, "#1a1a2e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, splitX, H);

  ctx.fillStyle = ACCENT;
  ctx.fillRect(splitX - 4, 0, 4, H);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  drawBrandMark(ctx, 60, 100, "#ffffff", 28);

  ctx.fillStyle = "#ffffff";
  ctx.font = "180px Anton";
  ctx.fillText(mm, 60, 480);
  ctx.fillStyle = ACCENT;
  ctx.fillText("/", 60, 660);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(dd, 60, 840);

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "700 36px Pretendard";
  ctx.fillText(`${dayOfWeekKr(today)}요일`, 60, 900);

  ctx.fillStyle = ACCENT;
  ctx.fillRect(60, H - 180, 60, 4);

  ctx.fillStyle = "#ffffff";
  ctx.font = "800 30px Pretendard";
  ctx.fillText("haeseol", 60, H - 110);
  ctx.fillStyle = ACCENT;
  ctx.fillText(".com →", 60 + ctx.measureText("haeseol").width, H - 110);

  return canvas.toBuffer("image/png");
}

/** V4: 상단 70% 이미지 + 하단 30% 다크 정보 패널 */
export async function renderHookV4(imagePath: string, mm: string, dd: string, today: string): Promise<Buffer> {
  const W = MAIN_CARD_SIZE.width;
  const H = MAIN_CARD_SIZE.height;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const splitY = Math.round(H * 0.68);

  const img = await loadImage(imagePath);
  drawCover(ctx, img, 0, 0, W, splitY, 0.25);

  const bg = ctx.createLinearGradient(0, splitY, 0, H);
  bg.addColorStop(0, "#08080d");
  bg.addColorStop(1, "#1a1a2e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, splitY, W, H - splitY);

  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, splitY - 4, W, 4);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  drawBrandMark(ctx, 70, 100, "#ffffff", 30);

  const dateY = splitY + 200;
  ctx.fillStyle = "#ffffff";
  ctx.font = "200px Anton";
  ctx.fillText(mm, 70, dateY);
  const mmW = ctx.measureText(mm).width;
  ctx.fillStyle = ACCENT;
  ctx.fillText("/", 70 + mmW + 14, dateY);
  const slashW = ctx.measureText("/").width;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(dd, 70 + mmW + 14 + slashW + 14, dateY);

  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "600 32px Pretendard";
  ctx.fillText(`${dayOfWeekKr(today)}요일`, 70, splitY + 70);

  ctx.fillStyle = ACCENT;
  ctx.font = "800 38px Pretendard";
  ctx.textAlign = "right";
  ctx.fillText("haeseol.com →", W - 70, dateY);
  ctx.textAlign = "left";

  return canvas.toBuffer("image/png");
}

/** V5: 풀이미지 + 좌상단 형광 그린 라벨에 날짜 (광고 스티커 느낌) */
export async function renderHookV5(imagePath: string, mm: string, dd: string, today: string): Promise<Buffer> {
  const W = MAIN_CARD_SIZE.width;
  const H = MAIN_CARD_SIZE.height;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const img = await loadImage(imagePath);
  drawCover(ctx, img, 0, 0, W, H, 0.35);

  const labelX = 60;
  const labelY = 60;
  const labelW = 360;
  const labelH = 200;

  ctx.fillStyle = ACCENT;
  ctx.fillRect(labelX, labelY, labelW, labelH);
  ctx.fillStyle = DARK_BG;
  ctx.fillRect(labelX, labelY, labelW, 6);

  ctx.fillStyle = DARK_BG;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";
  ctx.font = "140px Anton";
  ctx.fillText(`${mm}/${dd}`, labelX + labelW / 2, labelY + 145);

  ctx.font = "700 26px Pretendard";
  ctx.fillText(`${dayOfWeekKr(today)}요일`, labelX + labelW / 2, labelY + 185);

  ctx.textAlign = "left";

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 34px Pretendard";
  ctx.fillText("haeseol.com →", 70, H - 70);
  ctx.restore();

  return canvas.toBuffer("image/png");
}

/** V6: 풀이미지 + 하단 다크 오버레이에 빅매치 한 줄 결합 (1번 사진 대체용 후보) */
export async function renderHookV6(imagePath: string, mm: string, dd: string, today: string): Promise<Buffer> {
  const W = MAIN_CARD_SIZE.width;
  const H = MAIN_CARD_SIZE.height;
  const PAD = 80;
  const TEXT_PRIMARY = "#ffffff";
  const TEXT_DIM = "#9e9eb3";
  const TEXT_SUBTLE = "#5e5e74";

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const img = await loadImage(imagePath);
  drawCover(ctx, img, 0, 0, W, H, 0.3);

  const topShade = ctx.createLinearGradient(0, 0, 0, 200);
  topShade.addColorStop(0, "rgba(8,8,13,0.55)");
  topShade.addColorStop(1, "rgba(8,8,13,0)");
  ctx.fillStyle = topShade;
  ctx.fillRect(0, 0, W, 200);

  const DARK_TOP = 940;
  const darkBg = ctx.createLinearGradient(0, DARK_TOP, 0, H);
  darkBg.addColorStop(0, "rgba(8,8,13,0.42)");
  darkBg.addColorStop(0.5, "rgba(11,11,18,0.58)");
  darkBg.addColorStop(1, "rgba(15,15,25,0.75)");
  ctx.fillStyle = darkBg;
  ctx.fillRect(0, DARK_TOP, W, H - DARK_TOP);

  const glow = ctx.createRadialGradient(W * 0.85, H * 0.9, 0, W * 0.85, H * 0.9, 500);
  glow.addColorStop(0, "rgba(143, 255, 61, 0.10)");
  glow.addColorStop(1, "rgba(143, 255, 61, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, DARK_TOP, W, H - DARK_TOP);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  ctx.fillStyle = ACCENT;
  ctx.fillRect(PAD, 70, 6, 32);
  ctx.fillStyle = ACCENT;
  ctx.font = "800 30px Pretendard";
  drawTextWithShadow(ctx, "HAESEOL", PAD + 22, 95, 16, 0.6);
  const haeseolWidth = ctx.measureText("HAESEOL").width;

  ctx.fillStyle = "#ffffff";
  ctx.font = "600 28px Pretendard";
  drawTextWithShadow(ctx, "   오늘의 한국어 중계 편성표", PAD + 22 + haeseolWidth, 95, 16, 0.7);

  const dateBaseline = 880;
  ctx.font = "200px Anton";
  ctx.fillStyle = TEXT_PRIMARY;
  drawTextWithShadow(ctx, mm, PAD, dateBaseline, 26, 0.55);
  const mmW = ctx.measureText(mm).width;
  ctx.fillStyle = ACCENT;
  drawTextWithShadow(ctx, "/", PAD + mmW + 14, dateBaseline, 26, 0.55);
  const slashW = ctx.measureText("/").width;
  ctx.fillStyle = TEXT_PRIMARY;
  drawTextWithShadow(ctx, dd, PAD + mmW + 14 + slashW + 14, dateBaseline, 26, 0.55);
  const ddW = ctx.measureText(dd).width;
  const dateEndX = PAD + mmW + 14 + slashW + 14 + ddW;

  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = "700 36px Pretendard";
  drawTextWithShadow(ctx, `${dayOfWeekKr(today)}요일`, dateEndX + 24, dateBaseline, 16, 0.6);

  const dividerY1 = 990;
  ctx.fillStyle = TEXT_SUBTLE;
  ctx.fillRect(PAD, dividerY1, W - PAD * 2, 2);

  let yCursor = 1045;
  ctx.fillStyle = ACCENT;
  ctx.fillRect(PAD, yCursor - 28, 6, 32);
  ctx.fillStyle = ACCENT;
  ctx.font = "800 32px Pretendard";
  ctx.fillText("오늘의 빅매치", PAD + 22, yCursor);
  const labelW = ctx.measureText("오늘의 빅매치").width;

  const koreanMatches = loadKoreanMatchesAll(today);
  let hero = pickHeroMatch(koreanMatches);
  if (!hero) {
    const all = loadAllMatchesForDate(today);
    hero = pickHeroMatch(all);
  }

  if (hero) {
    const metaText = `${hero.league}  ${hero.time}  ·  ${hero.platform}`;
    const metaSize = fitText(ctx, metaText, W - (PAD + 22 + labelW + 28) - PAD, 28, "500", "Pretendard", 22);
    ctx.fillStyle = TEXT_DIM;
    ctx.font = `500 ${metaSize}px Pretendard`;
    ctx.fillText(metaText, PAD + 22 + labelW + 28, yCursor);

    yCursor += 90;

    const [homeLogo, awayLogo] = await Promise.all([
      fetchTeamLogoImage(hero.homeTeam),
      hero.awayTeam ? fetchTeamLogoImage(hero.awayTeam) : Promise.resolve(null),
    ]);

    if (hero.awayTeam) {
      const homeText = hero.homeTeam;
      const vsText = "  vs  ";
      const awayText = hero.awayTeam;
      const fullText = homeText + vsText + awayText;
      const matchSize = fitText(ctx, fullText, W - PAD * 2, 76, "800", "Pretendard", 48);
      ctx.font = `800 ${matchSize}px Pretendard`;
      const homeW = ctx.measureText(homeText).width;
      const vsW = ctx.measureText(vsText).width;
      const awayW = ctx.measureText(awayText).width;

      ctx.fillStyle = TEXT_PRIMARY;
      ctx.fillText(homeText, PAD, yCursor);
      ctx.fillStyle = TEXT_DIM;
      ctx.fillText(vsText, PAD + homeW, yCursor);
      ctx.fillStyle = TEXT_PRIMARY;
      ctx.fillText(awayText, PAD + homeW + vsW, yCursor);

      const logoSize = 80;
      const logoY = yCursor + 20;
      const homeCenterX = PAD + homeW / 2;
      const awayCenterX = PAD + homeW + vsW + awayW / 2;
      if (homeLogo) ctx.drawImage(homeLogo, homeCenterX - logoSize / 2, logoY, logoSize, logoSize);
      if (awayLogo) ctx.drawImage(awayLogo, awayCenterX - logoSize / 2, logoY, logoSize, logoSize);
    } else {
      const matchSize = fitText(ctx, hero.homeTeam, W - PAD * 2, 76, "800", "Pretendard", 48);
      ctx.fillStyle = TEXT_PRIMARY;
      ctx.font = `800 ${matchSize}px Pretendard`;
      ctx.fillText(hero.homeTeam, PAD, yCursor);
      if (homeLogo) {
        const logoSize = 80;
        const logoY = yCursor + 20;
        const homeCenterX = PAD + ctx.measureText(hero.homeTeam).width / 2;
        ctx.drawImage(homeLogo, homeCenterX - logoSize / 2, logoY, logoSize, logoSize);
      }
    }
  } else {
    yCursor += 70;
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "500 32px Pretendard";
    ctx.fillText("이날 한국어 해설 경기가 없어요", PAD, yCursor);
  }

  const dividerY2 = H - 100;
  ctx.fillStyle = TEXT_SUBTLE;
  ctx.fillRect(PAD, dividerY2, W - PAD * 2, 2);

  ctx.fillStyle = ACCENT;
  ctx.font = "800 42px Pretendard";
  ctx.fillText("haeseol.com", PAD, H - 45);
  const ctaW = ctx.measureText("haeseol.com").width;
  ctx.fillStyle = TEXT_PRIMARY;
  ctx.fillText("  →", PAD + ctaW, H - 45);

  return canvas.toBuffer("image/png");
}

/** V7: V3 좌측 다크 패널 + 빅매치 결합 (메인 카드 대체 후보, 검정 솔리드 유지) */
export async function renderHookV7(imagePath: string, mm: string, dd: string, today: string): Promise<Buffer> {
  const W = MAIN_CARD_SIZE.width;
  const H = MAIN_CARD_SIZE.height;
  const TEXT_PRIMARY = "#ffffff";
  const TEXT_DIM = "#9e9eb3";
  const TEXT_SUBTLE = "#5e5e74";

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const splitX = Math.round(W * 0.42);
  const PAD = 50;
  const contentW = splitX - PAD * 2;
  const centerX = PAD + contentW / 2;

  const img = await loadImage(imagePath);
  drawCover(ctx, img, splitX, 0, W - splitX, H, 0.32);

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#08080d");
  bg.addColorStop(0.6, "#11111e");
  bg.addColorStop(1, "#1a1a2e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, splitX, H);

  ctx.fillStyle = ACCENT;
  ctx.fillRect(splitX - 4, 0, 4, H);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  ctx.fillStyle = ACCENT;
  ctx.fillRect(PAD - 14, 90 - 24, 4, 30);
  ctx.fillStyle = TEXT_PRIMARY;
  ctx.font = "800 30px Pretendard";
  ctx.fillText("haeseol", PAD, 90);
  const ctaBaseW = ctx.measureText("haeseol").width;
  ctx.fillStyle = ACCENT;
  ctx.fillText(".com →", PAD + ctaBaseW, 90);

  const dateFontPx = 240;
  ctx.font = `${dateFontPx}px Anton`;
  const mmW = ctx.measureText(mm).width;
  const slashW = ctx.measureText("/").width;
  const ddW = ctx.measureText(dd).width;
  const mmX = PAD + (contentW - mmW) / 2;
  const slashX = PAD + (contentW - slashW) / 2;
  const ddX = PAD + (contentW - ddW) / 2;

  ctx.fillStyle = TEXT_PRIMARY;
  ctx.fillText(mm, mmX, 340);
  ctx.fillStyle = ACCENT;
  ctx.fillText("/", slashX, 580);
  ctx.fillStyle = TEXT_PRIMARY;
  ctx.fillText(dd, ddX, 820);

  ctx.fillStyle = TEXT_DIM;
  ctx.font = "700 44px Pretendard";
  ctx.textAlign = "center";
  ctx.fillText(`${dayOfWeekKr(today)}요일`, centerX, 890);
  ctx.textAlign = "left";

  ctx.fillStyle = TEXT_SUBTLE;
  ctx.fillRect(PAD, 935, contentW, 2);

  let yCursor = 985;
  ctx.fillStyle = ACCENT;
  ctx.fillRect(PAD - 14, yCursor - 22, 4, 28);
  ctx.fillStyle = ACCENT;
  ctx.font = "800 26px Pretendard";
  ctx.fillText("오늘의 빅매치", PAD, yCursor);

  const koreanMatches = loadKoreanMatchesAll(today);
  let hero = pickHeroMatch(koreanMatches);
  if (!hero) {
    const all = loadAllMatchesForDate(today);
    hero = pickHeroMatch(all);
  }

  if (hero) {
    yCursor += 40;
    const metaText = `${hero.league}  ${hero.time}  ·  ${hero.platform}`;
    const metaSize = fitText(ctx, metaText, contentW, 22, "500", "Pretendard", 16);
    ctx.fillStyle = TEXT_DIM;
    ctx.font = `500 ${metaSize}px Pretendard`;
    ctx.fillText(metaText, PAD, yCursor);

    const [homeLogo, awayLogo] = await Promise.all([
      fetchTeamLogoImage(hero.homeTeam),
      hero.awayTeam ? fetchTeamLogoImage(hero.awayTeam) : Promise.resolve(null),
    ]);

    const homeEn = findEnglishTeamName(hero.homeTeam) || "";
    const awayEn = hero.awayTeam ? findEnglishTeamName(hero.awayTeam) || "" : "";

    const drawTeamRow = (
      koreanName: string,
      logo: Image | null,
      enName: string,
      yKo: number,
    ) => {
      const koSize = fitText(ctx, koreanName, contentW, 40, "800", "Pretendard", 26);
      ctx.fillStyle = TEXT_PRIMARY;
      ctx.font = `800 ${koSize}px Pretendard`;
      ctx.fillText(koreanName, PAD, yKo);

      const logoSize = 42;
      const gap = 12;
      const rowY = yKo + 16;
      if (logo) {
        ctx.drawImage(logo, PAD, rowY, logoSize, logoSize);
      }
      if (enName) {
        ctx.fillStyle = TEXT_DIM;
        ctx.font = "600 22px Pretendard";
        ctx.textBaseline = "middle";
        ctx.fillText(enName, PAD + (logo ? logoSize + gap : 0), rowY + logoSize / 2);
        ctx.textBaseline = "alphabetic";
      }
    };

    if (hero.awayTeam) {
      yCursor += 60;
      drawTeamRow(hero.homeTeam, homeLogo, homeEn, yCursor);

      yCursor += 100;
      ctx.fillStyle = TEXT_DIM;
      ctx.font = "700 30px Pretendard";
      ctx.fillText("vs", PAD, yCursor);

      yCursor += 50;
      drawTeamRow(hero.awayTeam, awayLogo, awayEn, yCursor);
    } else {
      yCursor += 60;
      drawTeamRow(hero.homeTeam, homeLogo, homeEn, yCursor);
    }
  } else {
    yCursor += 70;
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "500 22px Pretendard";
    ctx.fillText("이날 한국어 해설", PAD, yCursor);
    yCursor += 32;
    ctx.fillText("경기가 없어요", PAD, yCursor);
  }

  return canvas.toBuffer("image/png");
}

export const HOOKS_DIR = path.resolve("templates/instagram/hooks");

/** 날짜 기반 결정적 픽 — 같은 날 재실행 시 같은 이미지 반환 */
export function pickHookImage(today: string): string {
  if (!fs.existsSync(HOOKS_DIR)) {
    throw new Error(`후킹 이미지 폴더 없음: ${HOOKS_DIR}`);
  }
  const files = fs.readdirSync(HOOKS_DIR)
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort();
  if (files.length === 0) {
    throw new Error(`후킹 이미지 없음: ${HOOKS_DIR}`);
  }

  let hash = 0;
  for (let i = 0; i < today.length; i++) {
    hash = ((hash << 5) - hash) + today.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % files.length;
  const picked = path.join(HOOKS_DIR, files[idx]);

  const sizeKB = fs.statSync(picked).size / 1024;
  if (sizeKB > 2048) {
    console.warn(`⚠️  후킹 이미지 ${sizeKB.toFixed(0)}KB로 큼 — web 압축 버전 권장 (${files[idx]})`);
  }
  console.log(`🎯 후킹 이미지: ${files[idx]} (${sizeKB.toFixed(0)}KB, ${idx + 1}/${files.length})`);
  return picked;
}

export const HOOK_VARIANTS = [
  { name: "V1", label: "좌측 거대 날짜 (이미지 자연 톤)", fn: renderHookV1 },
  { name: "V2", label: "하단 다크 페이드 + 가로 날짜", fn: renderHookV2 },
  { name: "V3", label: "좌측 다크 사이드 패널", fn: renderHookV3 },
  { name: "V4", label: "상하 분할 (이미지+다크 정보)", fn: renderHookV4 },
  { name: "V5", label: "풀이미지 + 형광 라벨 스티커", fn: renderHookV5 },
  { name: "V6", label: "V2 상단 + 빅매치 결합 (메인 카드 대체 후보)", fn: renderHookV6 },
  { name: "V7", label: "V3 좌측 다크 패널 + 빅매치 결합", fn: renderHookV7 },
] as const;
