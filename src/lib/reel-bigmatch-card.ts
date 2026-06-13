import { createCanvas, loadImage, type SKRSContext2D } from "@napi-rs/canvas";
import path from "node:path";
import type { Schedule } from "@/types/schedule";
import {
  fetchTeamLogoImage,
  KOREAN_PLAYERS,
  pickHeroForDate,
  inferDayLabel,
} from "./instagram";
import { eventWord } from "./hero-pick";

const REEL_W = 1080;
const REEL_H = 1920;
const ACCENT = "#8fff3d";

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
 * 빅매치 카드. title 카드 다음 컷에 사용.
 * 빅매치 없으면 null 반환 → make-reel-v2.ts가 컷 스킵.
 */
export async function renderReelBigMatchCard(today: string): Promise<{
  buf: Buffer;
  hero: Schedule;
} | null> {
  const hero = pickHeroForDate(today);
  if (!hero) return null;

  const canvas = createCanvas(REEL_W, REEL_H);
  const ctx = canvas.getContext("2d");

  // 1) 다크 그라데이션 배경
  const bg = ctx.createLinearGradient(0, 0, 0, REEL_H);
  bg.addColorStop(0, "#08080d");
  bg.addColorStop(0.5, "#0f0f1e");
  bg.addColorStop(1, "#1a1a2e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, REEL_W, REEL_H);

  // 2) 우상단 형광 글로우
  const glow = ctx.createRadialGradient(
    REEL_W * 0.85, REEL_H * 0.12, 0,
    REEL_W * 0.85, REEL_H * 0.12, 700,
  );
  glow.addColorStop(0, "rgba(143,255,61,0.20)");
  glow.addColorStop(1, "rgba(143,255,61,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, REEL_W, REEL_H);

  // 3) 좌하단 부드러운 보조 글로우
  const glow2 = ctx.createRadialGradient(
    REEL_W * 0.15, REEL_H * 0.88, 0,
    REEL_W * 0.15, REEL_H * 0.88, 600,
  );
  glow2.addColorStop(0, "rgba(143,255,61,0.10)");
  glow2.addColorStop(1, "rgba(143,255,61,0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, REEL_W, REEL_H);

  // 4) 상단 라벨 (한국 선수 출전이면 자존심 트리거)
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 3;

  const playerOnHero = KOREAN_PLAYERS.find(
    (p) => p.team === hero!.homeTeam || p.team === hero!.awayTeam,
  );

  const labelText = playerOnHero
    ? `🇰🇷 ${playerOnHero.name} 출전`
    : `🎯 ${inferDayLabel(today)}의 ${eventWord(hero)}`;
  ctx.fillStyle = ACCENT;
  ctx.font = "900 56px Pretendard";
  ctx.fillText(labelText, REEL_W / 2, 200);

  // 5) 리그명
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = "700 52px Pretendard";
  const leagueLabel = hero.league.toUpperCase();
  ctx.fillText(leagueLabel, REEL_W / 2, 290);

  // 6) 팀 로고 사전 로드
  const [homeLogo, awayLogo] = await Promise.all([
    fetchTeamLogoImage(hero.homeTeam),
    hero.awayTeam ? fetchTeamLogoImage(hero.awayTeam) : Promise.resolve(null),
  ]);

  // 7) 홈팀 (상단 블록)
  const HOME_NAME_Y = 460;
  const homeSize = fitText(ctx, hero.homeTeam, REEL_W - 140, 130, "900", 70);
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 ${homeSize}px Pretendard`;
  ctx.fillText(hero.homeTeam, REEL_W / 2, HOME_NAME_Y);

  if (homeLogo) {
    const logoSize = 220;
    ctx.drawImage(
      homeLogo,
      REEL_W / 2 - logoSize / 2,
      HOME_NAME_Y + 50,
      logoSize,
      logoSize,
    );
  }

  // 8) 가운데 VS — 형광, 약간 큰
  const VS_Y = 1020;
  ctx.fillStyle = ACCENT;
  ctx.font = "900 110px Pretendard";
  ctx.fillText("VS", REEL_W / 2, VS_Y);

  // 9) 원정팀 (하단 블록)
  if (hero.awayTeam) {
    const AWAY_NAME_Y = 1180;
    const awaySize = fitText(ctx, hero.awayTeam, REEL_W - 140, 130, "900", 70);
    ctx.fillStyle = "#ffffff";
    ctx.font = `900 ${awaySize}px Pretendard`;
    ctx.fillText(hero.awayTeam, REEL_W / 2, AWAY_NAME_Y);

    if (awayLogo) {
      const logoSize = 220;
      ctx.drawImage(
        awayLogo,
        REEL_W / 2 - logoSize / 2,
        AWAY_NAME_Y + 50,
        logoSize,
        logoSize,
      );
    }
  }

  // 10) 하단 정보 박스 — 시간 + 플랫폼 + 한국어 해설
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  const BOX_X = 100;
  const BOX_Y = REEL_H - 260;
  const BOX_W = REEL_W - 200;
  const BOX_H = 180;

  // 박스 배경 (반투명)
  ctx.fillStyle = "rgba(143,255,61,0.06)";
  ctx.fillRect(BOX_X, BOX_Y, BOX_W, BOX_H);
  ctx.strokeStyle = ACCENT;
  ctx.lineWidth = 3;
  ctx.strokeRect(BOX_X, BOX_Y, BOX_W, BOX_H);

  // 시간 (큰 형광)
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = ACCENT;
  ctx.font = "900 88px Pretendard";
  ctx.fillText(hero.time, REEL_W / 2, BOX_Y + 80);

  // 플랫폼 + 한국어 해설 + 한해설 로고 (✅ 대신 브랜드 로고로 교체)
  const hasKorean = hero.koreanCommentary === true;
  const subText = hasKorean
    ? `${hero.platform} · 한국어 해설`
    : hero.platform;

  // 텍스트 + 로고가 한 줄 박스 안에 들어가도록 사이즈 자동 조정
  let subSize = 42;
  const maxW = BOX_W - 60;
  while (subSize > 28) {
    ctx.font = `600 ${subSize}px Pretendard`;
    const tw = ctx.measureText(subText).width;
    const lw = hasKorean ? subSize + 14 : 0; // logo size + gap
    if (tw + lw <= maxW) break;
    subSize -= 4;
  }

  ctx.font = `600 ${subSize}px Pretendard`;
  const textW = ctx.measureText(subText).width;
  const logoSize = subSize; // 텍스트 높이에 맞춤
  const logoGap = 14;
  const totalW = textW + (hasKorean ? logoGap + logoSize : 0);
  const startX = (REEL_W - totalW) / 2;

  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.fillText(subText, startX, BOX_Y + 140);

  if (hasKorean) {
    try {
      const logo = await loadImage(path.resolve("public/logo.png"));
      ctx.drawImage(
        logo,
        startX + textW + logoGap,
        BOX_Y + 140 - logoSize + 6,
        logoSize,
        logoSize,
      );
    } catch {
      // 로고 로드 실패 시 텍스트만
    }
  }
  ctx.textAlign = "center";

  return { buf: canvas.toBuffer("image/png"), hero };
}
