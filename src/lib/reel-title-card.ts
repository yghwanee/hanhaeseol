import { createCanvas, loadImage, type SKRSContext2D, type Image } from "@napi-rs/canvas";
import type { Schedule } from "@/types/schedule";
import {
  loadKoreanMatchesAll,
  loadAllMatchesForDate,
  KOREAN_PLAYERS,
  pickHeroMatch,
  inferDayLabel,
} from "./instagram";

const REEL_W = 1080;
const REEL_H = 1920;
const ACCENT = "#8fff3d";
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
  focusY = 0.35,
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

function fitText(
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number,
  baseSize: number,
  weight: string,
  minSize: number,
): number {
  let size = baseSize;
  ctx.font = `${weight} ${size}px Pretendard`;
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size -= 4;
    ctx.font = `${weight} ${size}px Pretendard`;
  }
  return size;
}

/**
 * title 카드 배경 PNG — 풀스크린 AI 이미지 + 어두운 vignette.
 * 텍스트는 renderReelTitleText()로 별도 PNG 생성 후 ffmpeg overlay에서 모션 적용.
 */
export async function renderReelTitleBackground(imagePath: string): Promise<Buffer> {
  const canvas = createCanvas(REEL_W, REEL_H);
  const ctx = canvas.getContext("2d");

  const img = await loadImage(imagePath);
  drawCover(ctx, img, 0, 0, REEL_W, REEL_H, 0.32);

  // 상단 vignette
  const topShade = ctx.createLinearGradient(0, 0, 0, 280);
  topShade.addColorStop(0, "rgba(8,8,13,0.60)");
  topShade.addColorStop(1, "rgba(8,8,13,0)");
  ctx.fillStyle = topShade;
  ctx.fillRect(0, 0, REEL_W, 280);

  // 하단 vignette
  const VIGNETTE_TOP = REEL_H - 820;
  const vignette = ctx.createLinearGradient(0, VIGNETTE_TOP, 0, REEL_H);
  vignette.addColorStop(0, "rgba(8,8,13,0)");
  vignette.addColorStop(0.35, "rgba(8,8,13,0.55)");
  vignette.addColorStop(0.7, "rgba(8,8,13,0.82)");
  vignette.addColorStop(1, "rgba(8,8,13,0.95)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, VIGNETTE_TOP, REEL_W, 820);

  return canvas.toBuffer("image/png");
}

/**
 * title 카드 텍스트 PNG — 투명 배경에 모든 텍스트 + 하단 한해설 로고.
 * ffmpeg overlay에서 페이드인/슬라이드 모션으로 합성하거나, renderReelTitleCard()로 합본.
 */
export async function renderReelTitleText(today: string): Promise<Buffer> {
  const canvas = createCanvas(REEL_W, REEL_H);
  const ctx = canvas.getContext("2d");

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // 텍스트 가독성용 약한 shadow
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;

  // 상단 브랜드
  ctx.fillStyle = ACCENT;
  ctx.fillRect(60, 130 - 30, 6, 38);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 38px Pretendard";
  ctx.fillText("haeseol", 80, 130);
  const haeW = ctx.measureText("haeseol").width;
  ctx.fillStyle = ACCENT;
  ctx.fillText(".com", 80 + haeW, 130);

  // 타이틀 콘텐츠 결정
  const koreanMatches = loadKoreanMatchesAll(today);
  const n = koreanMatches.length;
  let hero: Schedule | null = pickHeroMatch(koreanMatches);
  if (!hero) hero = pickHeroMatch(loadAllMatchesForDate(today));

  const playerOnHero = hero
    ? KOREAN_PLAYERS.find(
        (p) => p.team === hero!.homeTeam || p.team === hero!.awayTeam,
      )
    : undefined;

  const dayLabel = inferDayLabel(today);
  let bigLine = "";
  let subLine = "";

  if (playerOnHero) {
    bigLine = `${playerOnHero.name} 출전`;
    subLine = `${dayLabel} 한국어 해설 ${n}경기`;
  } else if (n > 0 && hero) {
    bigLine = `${hero.time} 빅매치`;
    subLine = `${dayLabel} 한국어 해설 ${n}경기`;
  } else if (n > 0) {
    bigLine = `한국어 해설 ${n}경기`;
    subLine = `${dayLabel}의 중계 편성표`;
  } else {
    bigLine = `${dayLabel}의 한국어 중계`;
    subLine = "haeseol.com";
  }

  ctx.textAlign = "center";
  const centerX = REEL_W / 2;

  // 날짜 + 요일 (Anton 큰 숫자 + Pretendard 요일)
  const [, mm, dd] = today.split("-");
  const dow = dayOfWeekKr(today);
  const dateText = `${Number(mm)}/${Number(dd)}`;
  const dowText = `${dow}요일`;

  const DATE_BASELINE = REEL_H - 600;
  ctx.font = "160px Anton";
  const dateW = ctx.measureText(dateText).width;
  ctx.font = "800 96px Pretendard";
  const dowW = ctx.measureText(dowText).width;
  const gap = 28;
  const totalW = dateW + gap + dowW;
  const startX = (REEL_W - totalW) / 2;

  ctx.textAlign = "left";
  ctx.fillStyle = ACCENT;
  ctx.font = "160px Anton";
  ctx.fillText(dateText, startX, DATE_BASELINE);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 96px Pretendard";
  ctx.fillText(dowText, startX + dateW + gap, DATE_BASELINE - 20);
  ctx.textAlign = "center";

  // 큰 타이틀
  const bigSize = fitText(ctx, bigLine, REEL_W - 120, 140, "900", 88);
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${bigSize}px Pretendard`;
  ctx.fillText(bigLine, centerX, REEL_H - 420);

  // 서브 라인
  const subSize = fitText(ctx, subLine, REEL_W - 160, 60, "600", 44);
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `600 ${subSize}px Pretendard`;
  ctx.fillText(subLine, centerX, REEL_H - 320);

  // 하단 — 한해설 로고 + haeseol.com (영상이라 스와이프 CTA는 의미 없음)
  const LOGO_BASELINE = REEL_H - 120;
  const LOGO_SIZE = 88;
  const LOGO_GAP = 22;

  let logoImg = null;
  try {
    logoImg = await loadImage("public/logo.png");
  } catch {
    // 로고 로드 실패 시 텍스트만
  }

  ctx.font = "900 64px Pretendard";
  const brandText = "haeseol.com";
  const brandW = ctx.measureText(brandText).width;
  const blockW = (logoImg ? LOGO_SIZE + LOGO_GAP : 0) + brandW;
  const blockStartX = (REEL_W - blockW) / 2;

  if (logoImg) {
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.5)";
    ctx.shadowBlur = 12;
    ctx.drawImage(
      logoImg,
      blockStartX,
      LOGO_BASELINE - LOGO_SIZE + 18,
      LOGO_SIZE,
      LOGO_SIZE,
    );
    ctx.restore();
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.shadowColor = "rgba(0,0,0,0.8)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 64px Pretendard";
  ctx.fillText(
    brandText,
    blockStartX + (logoImg ? LOGO_SIZE + LOGO_GAP : 0),
    LOGO_BASELINE,
  );

  return canvas.toBuffer("image/png");
}

/**
 * 합본 — 배경+텍스트를 한 PNG로 만드는 헬퍼. 영상 모션 없이 단일 카드가 필요할 때 사용.
 * (현재 make-reel-v2는 분리된 두 PNG를 overlay 모션으로 합성하므로 직접 사용 안 함.)
 */
export async function renderReelTitleCard(
  imagePath: string,
  today: string,
): Promise<Buffer> {
  const bg = await renderReelTitleBackground(imagePath);
  const txt = await renderReelTitleText(today);

  const canvas = createCanvas(REEL_W, REEL_H);
  const ctx = canvas.getContext("2d");
  const bgImg = await loadImage(bg);
  ctx.drawImage(bgImg, 0, 0);
  const txtImg = await loadImage(txt);
  ctx.drawImage(txtImg, 0, 0);
  return canvas.toBuffer("image/png");
}
