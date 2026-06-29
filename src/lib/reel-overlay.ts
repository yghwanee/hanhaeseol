import { createCanvas } from "@napi-rs/canvas";

const REEL_W = 1080;
const REEL_H = 1920;
const ACCENT = "#8fff3d";

/**
 * 영상 마지막 컷(outro) 위에 합성할 CTA 오버레이 PNG.
 * "지금 저장 ↓" 큰 행동 카피 + "haeseol.com →" 강조.
 * 페이드인은 ffmpeg fade=t=in:alpha=1, 펄스는 outro 컷의 zoompan에서.
 */
export function renderCtaOverlay(opts: { noUrl?: boolean } = {}): Buffer {
  const noUrl = opts.noUrl ?? false;
  const canvas = createCanvas(REEL_W, REEL_H);
  const ctx = canvas.getContext("2d");

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";

  // 하단 어두운 vignette
  const veilTop = REEL_H - 620;
  const veil = ctx.createLinearGradient(0, veilTop, 0, REEL_H);
  veil.addColorStop(0, "rgba(8,8,13,0)");
  veil.addColorStop(0.4, "rgba(8,8,13,0.60)");
  veil.addColorStop(1, "rgba(8,8,13,0.92)");
  ctx.fillStyle = veil;
  ctx.fillRect(0, veilTop, REEL_W, 620);

  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 4;

  // 큰 형광 CTA + 흰 화살표. 틱톡(noUrl)은 URL 대신 브랜드 검색 유도.
  ctx.fillStyle = ACCENT;
  ctx.font = "900 116px Pretendard";
  const url = noUrl ? "한해설 검색" : "haeseol.com";
  const urlW = ctx.measureText(url).width;
  ctx.textAlign = "left";
  const arrowW = ctx.measureText("  →").width;
  const startX = (REEL_W - urlW - arrowW) / 2;
  ctx.fillText(url, startX, REEL_H - 240);
  ctx.fillStyle = "#ffffff";
  ctx.fillText("  →", startX + urlW, REEL_H - 240);

  // 보조 — 브랜드 캐치프레이즈
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,0.65)";
  ctx.font = "600 38px Pretendard";
  ctx.fillText("한국어 해설은 한해설", REEL_W / 2, REEL_H - 130);

  return canvas.toBuffer("image/png");
}
