import { createCanvas, loadImage, GlobalFonts, type SKRSContext2D, type Image } from "@napi-rs/canvas";
import fs from "fs";
import path from "path";
import type { Schedule, ScheduleData, Sport } from "@/types/schedule";
import { getTeamLogo } from "@/data/team-logos";

async function fetchTeamLogoImage(name: string): Promise<Image | null> {
  const url = getTeamLogo(name);
  if (!url) return null;
  try {
    if (url.startsWith("http")) {
      const res = await fetch(url);
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return await loadImage(buf);
    }
    const localPath = path.resolve("public", url.replace(/^\//, ""));
    return await loadImage(localPath);
  } catch {
    return null;
  }
}

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

export const MAIN_CARD_SIZE = { width: 1080, height: 1350 };

const HERO_LEAGUE_PRIORITY = [
  "프리미어리그",
  "챔피언스리그",
  "유로파리그",
  "라리가",
  "분데스리가",
  "세리에A",
  "리그 1",
  "MLB",
  "K리그",
  "K리그2",
  "ACL",
  "KBO",
  "MLS",
  "NBA",
  "KBL",
  "WKBL",
  "잉글랜드 FA컵",
  "EFL 챔피언십",
  "컨퍼런스리그",
];

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
  // KST 21:00에 내일 편성 미리보기를 올리는 구조라 "내일" 날짜를 반환합니다.
  const kstStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" });
  const d = new Date(kstStr);
  d.setDate(d.getDate() + 1);
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

function loadKoreanMatchesAll(today: string): Schedule[] {
  try {
    const data: ScheduleData = JSON.parse(
      fs.readFileSync(path.resolve("public/schedule.json"), "utf-8"),
    );
    return data.schedules
      .filter((s) => s.date === today && s.koreanCommentary === true)
      .sort((a, b) => a.time.localeCompare(b.time));
  } catch {
    return [];
  }
}

function loadAllMatchesForDate(today: string): Schedule[] {
  try {
    const data: ScheduleData = JSON.parse(
      fs.readFileSync(path.resolve("public/schedule.json"), "utf-8"),
    );
    return data.schedules
      .filter((s) => s.date === today)
      .sort((a, b) => a.time.localeCompare(b.time));
  } catch {
    return [];
  }
}

function pickHeroMatch(matches: Schedule[]): Schedule | null {
  if (matches.length === 0) return null;
  for (const lg of HERO_LEAGUE_PRIORITY) {
    const found = matches.find((m) => m.league === lg);
    if (found) return found;
  }
  return matches[0];
}

function fitText(
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number,
  baseSize: number,
  weight: string,
  fontFamily: string,
  minSize: number,
): number {
  let size = baseSize;
  ctx.font = `${weight} ${size}px ${fontFamily}`;
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size -= 4;
    ctx.font = `${weight} ${size}px ${fontFamily}`;
  }
  return size;
}

const KST_DOW = ["일", "월", "화", "수", "목", "금", "토"];

function dayOfWeekKr(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return KST_DOW[dt.getUTCDay()];
}

export async function renderMainCard(
  mm: string,
  dd: string,
  today: string,
): Promise<Buffer> {
  const W = MAIN_CARD_SIZE.width;
  const H = MAIN_CARD_SIZE.height;
  const PAD = 80;
  const ACCENT = "#8fff3d";
  const TEXT_PRIMARY = "#ffffff";
  const TEXT_DIM = "#9e9eb3";
  const TEXT_SUBTLE = "#5e5e74";

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // 1. 배경 — 깊은 다크 그라데이션
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#08080d");
  bg.addColorStop(0.6, "#11111e");
  bg.addColorStop(1, "#1a1a2e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 2. 우상단 형광 그라데이션 글로우 (방사형)
  const glow = ctx.createRadialGradient(W * 0.85, H * 0.15, 0, W * 0.85, H * 0.15, 600);
  glow.addColorStop(0, "rgba(143, 255, 61, 0.18)");
  glow.addColorStop(1, "rgba(143, 255, 61, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // 3. 상단 형광 라인 + 라벨
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, 0, W, 6);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // 형광 막대 액센트
  ctx.fillStyle = ACCENT;
  ctx.fillRect(PAD, 70, 6, 32);

  ctx.fillStyle = ACCENT;
  ctx.font = "800 30px Pretendard";
  ctx.fillText("HAESEOL", PAD + 22, 95);
  const haeseolWidth = ctx.measureText("HAESEOL").width;

  ctx.fillStyle = TEXT_DIM;
  ctx.font = "500 28px Pretendard";
  ctx.fillText("   오늘의 한국어 중계 편성표", PAD + 22 + haeseolWidth, 95);

  // 4. 거대한 날짜 (MM / DD) + 요일 옆에
  const DATE_BASELINE = 510;

  ctx.fillStyle = TEXT_PRIMARY;
  ctx.font = "320px Anton";
  ctx.fillText(mm, PAD, DATE_BASELINE);
  const mmWidth = ctx.measureText(mm).width;

  ctx.fillStyle = ACCENT;
  ctx.font = "320px Anton";
  ctx.fillText("/", PAD + mmWidth + 20, DATE_BASELINE);
  const slashWidth = ctx.measureText("/").width;

  ctx.fillStyle = TEXT_PRIMARY;
  ctx.font = "320px Anton";
  ctx.fillText(dd, PAD + mmWidth + 20 + slashWidth + 20, DATE_BASELINE);
  const ddWidth = ctx.measureText(dd).width;
  const dateEndX = PAD + mmWidth + 20 + slashWidth + 20 + ddWidth;

  // 요일 — 날짜 옆 (날짜 베이스라인과 정렬)
  const dow = dayOfWeekKr(today);
  ctx.fillStyle = TEXT_DIM;
  const dowSize = fitText(
    ctx,
    `${dow}요일`,
    W - PAD - dateEndX - 40,
    78,
    "700",
    "Pretendard",
    48,
  );
  ctx.font = `700 ${dowSize}px Pretendard`;
  ctx.fillText(`${dow}요일`, dateEndX + 32, DATE_BASELINE);

  // 5. 가로 디바이더
  ctx.fillStyle = TEXT_SUBTLE;
  ctx.fillRect(PAD, 605, W - PAD * 2, 2);

  // 6. 오늘의 빅매치 섹션
  // 한국어 해설 경기 중에서 우선 픽 → 없으면 그날 전체 경기 중에서 폴백
  const koreanMatches = loadKoreanMatchesAll(today);
  let hero = pickHeroMatch(koreanMatches);
  if (!hero) {
    const allMatches = loadAllMatchesForDate(today);
    hero = pickHeroMatch(allMatches);
  }
  const matches = koreanMatches;

  let yCursor = 680;

  // 형광 막대 액센트
  ctx.fillStyle = ACCENT;
  ctx.fillRect(PAD, yCursor - 28, 6, 32);

  ctx.fillStyle = ACCENT;
  ctx.font = "800 34px Pretendard";
  ctx.fillText("오늘의 빅매치", PAD + 22, yCursor);

  if (hero) {
    yCursor += 70;

    // 리그 + 시간/플랫폼 (한 줄)
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "600 36px Pretendard";
    const leagueText = hero.league.toUpperCase();
    ctx.fillText(leagueText, PAD, yCursor);
    const leagueW = ctx.measureText(leagueText).width;

    ctx.fillStyle = TEXT_DIM;
    ctx.font = "500 30px Pretendard";
    const timePlatform = `${hero.time}  ·  ${hero.platform}`;
    ctx.fillText(timePlatform, PAD + leagueW + 28, yCursor);

    yCursor += 100;

    // 팀 로고 사전 로드
    const [homeLogo, awayLogo] = await Promise.all([
      fetchTeamLogoImage(hero.homeTeam),
      hero.awayTeam ? fetchTeamLogoImage(hero.awayTeam) : Promise.resolve(null),
    ]);

    // 팀 매치업 (HOME vs AWAY) — 3등분으로 나눠 그려서 각 팀 위치를 추적
    if (hero.awayTeam) {
      const homeText = hero.homeTeam;
      const vsText = "  vs  ";
      const awayText = hero.awayTeam;
      const fullText = homeText + vsText + awayText;

      const matchSize = fitText(ctx, fullText, W - PAD * 2, 90, "800", "Pretendard", 56);
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

      // 각 팀 이름 밑에 로고 그리기
      const logoSize = 100;
      const logoY = yCursor + 30;
      const homeCenterX = PAD + homeW / 2;
      const awayCenterX = PAD + homeW + vsW + awayW / 2;

      if (homeLogo) {
        ctx.drawImage(homeLogo, homeCenterX - logoSize / 2, logoY, logoSize, logoSize);
      }
      if (awayLogo) {
        ctx.drawImage(awayLogo, awayCenterX - logoSize / 2, logoY, logoSize, logoSize);
      }

      yCursor += 30 + logoSize;
    } else {
      const matchSize = fitText(ctx, hero.homeTeam, W - PAD * 2, 90, "800", "Pretendard", 56);
      ctx.fillStyle = TEXT_PRIMARY;
      ctx.font = `800 ${matchSize}px Pretendard`;
      ctx.fillText(hero.homeTeam, PAD, yCursor);

      // 단일 팀 로고
      if (homeLogo) {
        const logoSize = 100;
        const logoY = yCursor + 30;
        const homeCenterX = PAD + ctx.measureText(hero.homeTeam).width / 2;
        ctx.drawImage(homeLogo, homeCenterX - logoSize / 2, logoY, logoSize, logoSize);
        yCursor += 30 + logoSize;
      } else {
        yCursor += 30;
      }
    }
  } else {
    yCursor += 70;
    ctx.fillStyle = TEXT_DIM;
    ctx.font = "500 38px Pretendard";
    ctx.fillText("이날 한국어 해설 경기가 없어요", PAD, yCursor);
  }

  // 7. 추가 경기 카운트 (한국어 해설 기준)
  const heroIsKorean = hero ? matches.some((m) => m.id === hero.id) : false;
  const remainingKorean = heroIsKorean ? matches.length - 1 : matches.length;

  if (remainingKorean > 0) {
    yCursor += 90;
    ctx.fillStyle = ACCENT;
    ctx.font = "700 38px Pretendard";
    ctx.fillText(`+ ${remainingKorean}`, PAD, yCursor);
    const plusWidth = ctx.measureText(`+ ${remainingKorean}`).width;

    ctx.fillStyle = TEXT_DIM;
    ctx.font = "500 36px Pretendard";
    ctx.fillText("  경기 더보기", PAD + plusWidth, yCursor);
  }

  // 8. 하단 CTA 영역
  const bottomBlockY = H - 200;
  ctx.fillStyle = TEXT_SUBTLE;
  ctx.fillRect(PAD, bottomBlockY, W - PAD * 2, 2);

  // 종목 행: 작은 점 + 텍스트
  ctx.fillStyle = TEXT_DIM;
  ctx.font = "600 28px Pretendard";
  const sportLabels = ["축구", "야구", "농구", "배구"];
  let sx = PAD;
  for (let i = 0; i < sportLabels.length; i++) {
    // 작은 형광 점
    ctx.fillStyle = ACCENT;
    ctx.beginPath();
    ctx.arc(sx + 8, bottomBlockY + 56, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = TEXT_DIM;
    ctx.fillText(sportLabels[i], sx + 22, bottomBlockY + 65);
    sx += ctx.measureText(sportLabels[i]).width + 70;
  }

  // haeseol.com  →
  ctx.fillStyle = ACCENT;
  ctx.font = "800 56px Pretendard";
  ctx.fillText("haeseol.com", PAD, bottomBlockY + 145);
  const cta = ctx.measureText("haeseol.com").width;

  ctx.fillStyle = TEXT_PRIMARY;
  ctx.font = "800 56px Pretendard";
  ctx.fillText("  →", PAD + cta, bottomBlockY + 145);

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

export async function renderOutroCard(): Promise<Buffer> {
  const W = MAIN_CARD_SIZE.width;
  const H = MAIN_CARD_SIZE.height;
  const PAD = 80;
  const ACCENT = "#8fff3d";
  const TEXT_PRIMARY = "#ffffff";
  const TEXT_DIM = "#9e9eb3";
  const TEXT_SUBTLE = "#5e5e74";

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  // 1. 배경 다크 그라데이션 (메인 카드와 동일)
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#08080d");
  bg.addColorStop(0.6, "#11111e");
  bg.addColorStop(1, "#1a1a2e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // 2. 우상단 형광 글로우
  const glow = ctx.createRadialGradient(W * 0.85, H * 0.15, 0, W * 0.85, H * 0.15, 600);
  glow.addColorStop(0, "rgba(143, 255, 61, 0.18)");
  glow.addColorStop(1, "rgba(143, 255, 61, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // 3. 상단 형광 라인 + 라벨
  ctx.fillStyle = ACCENT;
  ctx.fillRect(0, 0, W, 6);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  ctx.fillStyle = ACCENT;
  ctx.fillRect(PAD, 70, 6, 32);

  ctx.fillStyle = ACCENT;
  ctx.font = "800 30px Pretendard";
  ctx.fillText("HAESEOL", PAD + 22, 95);
  const haeseolWidth = ctx.measureText("HAESEOL").width;

  ctx.fillStyle = TEXT_DIM;
  ctx.font = "500 28px Pretendard";
  ctx.fillText("   한국어 해설 편성표", PAD + 22 + haeseolWidth, 95);

  // 4. 거대 브랜드 영역 (중앙)
  ctx.textAlign = "center";

  ctx.fillStyle = TEXT_PRIMARY;
  ctx.font = "900 220px Pretendard";
  ctx.fillText("한해설", W / 2, 360);

  ctx.fillStyle = ACCENT;
  ctx.fillRect(W / 2 - 80, 400, 160, 4);

  ctx.fillStyle = TEXT_DIM;
  ctx.font = "600 38px Pretendard";
  ctx.fillText("한국어 해설 편성표", W / 2, 470);

  ctx.fillStyle = TEXT_SUBTLE;
  ctx.font = "500 28px Pretendard";
  ctx.fillText("축구 · 야구 · 농구 · 배구  /  10개 플랫폼 통합", W / 2, 520);

  ctx.textAlign = "left";

  // 5. 플랫폼 2열 리스트
  ctx.fillStyle = TEXT_DIM;
  ctx.font = "700 28px Pretendard";
  ctx.fillText("OTT", PAD + 60, 620);
  ctx.fillText("TV 채널", W / 2 + 60, 620);

  ctx.fillStyle = TEXT_PRIMARY;
  ctx.font = "600 32px Pretendard";

  const ottList = ["SPOTV NOW", "쿠팡플레이", "티빙", "Apple TV+"];
  const tvList = [
    "SPOTV / SPOTV2",
    "tvN SPORTS",
    "KBS N SPORTS",
    "MBC SPORTS+",
    "SBS Sports",
  ];

  ottList.forEach((p, i) => {
    const y = 680 + i * 50;
    ctx.fillStyle = ACCENT;
    ctx.beginPath();
    ctx.arc(PAD + 60 + 5, y - 12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = TEXT_PRIMARY;
    ctx.fillText(p, PAD + 60 + 22, y);
  });

  tvList.forEach((p, i) => {
    const y = 680 + i * 50;
    ctx.fillStyle = ACCENT;
    ctx.beginPath();
    ctx.arc(W / 2 + 60 + 5, y - 12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = TEXT_PRIMARY;
    ctx.fillText(p, W / 2 + 60 + 22, y);
  });

  // 6. 하단 CTA 박스
  const ctaY = H - 280;
  const ctaBoxH = 130;

  // 박스 (형광 테두리)
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 3;
  ctx.strokeRect(PAD, ctaY, W - PAD * 2, ctaBoxH);

  ctx.textAlign = "center";

  ctx.fillStyle = ACCENT;
  ctx.font = "900 64px Pretendard";
  ctx.fillText("haeseol.com  →", W / 2, ctaY + ctaBoxH / 2 + 22);

  ctx.textAlign = "left";

  // 7. 하단 footer
  ctx.fillStyle = TEXT_SUBTLE;
  ctx.fillRect(PAD, H - 110, W - PAD * 2, 2);

  ctx.fillStyle = TEXT_DIM;
  ctx.font = "500 26px Pretendard";
  ctx.textAlign = "center";
  ctx.fillText("매일 자동 업데이트  ·  한국어 해설 여부 표시", W / 2, H - 60);
  ctx.textAlign = "left";

  return canvas.toBuffer("image/png");
}

export async function sendTelegramDocument(
  buf: Buffer,
  filename: string,
  caption?: string,
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 가 .env 에 없습니다");

  const form = new FormData();
  form.append("chat_id", chatId);
  if (caption) form.append("caption", caption);
  form.append("document", new Blob([new Uint8Array(buf)]), filename);

  const res = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(`Telegram Document 전송 실패: ${res.status} ${await res.text()}`);
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
