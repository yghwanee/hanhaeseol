import { createCanvas, loadImage, type SKRSContext2D, type Image } from "@napi-rs/canvas";
import { buildCoverHook } from "./cover-hook";
import { fetchTeamLogoImage, pickHeroForDate } from "./instagram";
import { getPostSlot, type PostSlot } from "./post-slot";

/**
 * 슬롯별 액센트 — 레이아웃이 같아져도 썸네일 그리드에서 한눈에 갈린다.
 * 저녁판과 다음날 아침판은 대상 날짜·히어로가 같아서(작업82) 색이 실질적인 구분선이다.
 */
export const SLOT_ACCENT: Record<PostSlot, string> = {
  morning: "#ffb02e",
  evening: "#8fff3d",
};

const KST_DOW = ["일", "월", "화", "수", "목", "금", "토"];

export type ReelTitleAspect = "9:16" | "4:5";

export interface ReelBrandOpts {
  /** true면 URL(haeseol.com) 대신 한글 브랜드(한해설) 사용 — 틱톡 워터마크/URL 억제 회피용. */
  noUrl?: boolean;
  /** 슬롯 강제 지정 — 미지정이면 대상 날짜로 판정한다. 미리보기·테스트용. */
  slot?: PostSlot;
  /**
   * true 면 AI 생성 사진을 쓰지 않고 **그래픽 배경**을 그린다(틱톡 전용).
   *
   * 🔴 배경 사진 183장이 전부 ChatGPT 생성물이라, 이걸 쓰는 한 `is_aigc` 를
   * 정직하게 붙여야 한다. 틱톡에서는 그 라벨과 "AI 양산 계정" 분류가 도달을
   * 깎는 쪽으로 관측돼(2026-09-01 조사) 틱톡판만 사진을 뺀다.
   * IG·유튜브판은 그대로다.
   */
  noAiImage?: boolean;
}

/**
 * 날짜마다 달라지는 그래픽 배경. 사진 없이도 밋밋하지 않게, 그리고
 * **매일 같은 프레임이 나가지 않게**(중복 신호) 각도·위치를 날짜로 흔든다.
 */
function drawSyntheticBackground(
  ctx: SKRSContext2D,
  W: number,
  H: number,
  accent: string,
  today: string,
) {
  const seed = today.split("-").reduce((a, p) => a * 31 + Number(p), 7);
  const gx = 0.25 + ((seed * 7) % 50) / 100; // 0.25~0.75
  const gy = 0.18 + ((seed * 13) % 30) / 100; // 0.18~0.48

  ctx.fillStyle = "#0b0d12";
  ctx.fillRect(0, 0, W, H);

  // 액센트 글로우 — 위치가 날마다 움직인다
  const glow = ctx.createRadialGradient(
    W * gx, H * gy, 0,
    W * gx, H * gy, Math.max(W, H) * 0.72,
  );
  glow.addColorStop(0, hexWithAlpha(accent, 0.3));
  glow.addColorStop(0.45, hexWithAlpha(accent, 0.08));
  glow.addColorStop(1, "rgba(11,13,18,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // 대각 스트라이프 — 각도도 날마다 조금씩 다르다
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.translate(W / 2, H / 2);
  ctx.rotate(((seed % 24) - 12) * (Math.PI / 180) - Math.PI / 5);
  for (let x = -H; x < H * 1.4; x += 52) {
    ctx.beginPath();
    ctx.moveTo(x, -H);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  ctx.restore();

  // 아래쪽을 어둡게 — 본문 텍스트 가독성
  const bottom = ctx.createLinearGradient(0, H * 0.45, 0, H);
  bottom.addColorStop(0, "rgba(8,8,13,0)");
  bottom.addColorStop(1, "rgba(8,8,13,0.85)");
  ctx.fillStyle = bottom;
  ctx.fillRect(0, H * 0.45, W, H * 0.55);
}

/**
 * 히어로 경기의 두 팀 엠블럼을 가운데 크게. 원격 로고는 실패할 수 있으므로
 * 호출부에서 catch 한다 — 배경이 없는 것보다 엠블럼이 없는 게 낫다.
 */
async function drawHeroEmblems(ctx: SKRSContext2D, W: number, H: number, today: string) {
  const hero = pickHeroForDate(today);
  if (!hero) return;

  const [home, away] = await Promise.all([
    fetchTeamLogoImage(hero.homeTeam).catch(() => null),
    hero.awayTeam ? fetchTeamLogoImage(hero.awayTeam).catch(() => null) : null,
  ]);
  if (!home && !away) return;

  const size = Math.round(W * 0.3);
  const cy = Math.round(H * 0.4);
  const both = Boolean(home && away);
  const gap = Math.round(W * 0.1);

  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = 28;
  if (both) {
    ctx.drawImage(home!, W / 2 - size - gap / 2, cy - size / 2, size, size);
    ctx.drawImage(away!, W / 2 + gap / 2, cy - size / 2, size, size);
  } else {
    const one = (home ?? away)!;
    ctx.drawImage(one, W / 2 - size / 2, cy - size / 2, size, size);
  }
  ctx.restore();

  if (both) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "800 44px Pretendard";
    ctx.fillText("VS", W / 2, cy);
    ctx.restore();
  }
}

/** "#rrggbb" + alpha → rgba(). accent 상수가 hex 라 이 변환이 필요하다. */
function hexWithAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const n = Number.parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// 9:16 (1080x1920): 릴스 영상 본 비율.
// 4:5 (1080x1350): 인스타 피드 캐러셀 + 릴스 cover_url.
// 같은 디자인 파라미터화로 캐러셀 첫 장과 릴스 썸네일을 동일 PNG로 통일.
function aspectSize(aspect: ReelTitleAspect): { W: number; H: number } {
  return aspect === "9:16" ? { W: 1080, H: 1920 } : { W: 1080, H: 1350 };
}

/**
 * 아침 커버의 사진/블록 경계.
 *
 * 두 슬롯이 같은 날짜·같은 히어로를 대상으로 하다 보니(작업82) 색·정렬·문구 순서만으로는
 * 썸네일 크기에서 구분이 안 됐다. 아침만 구도를 쪼개 실루엣부터 다르게 한다 —
 * 아침은 경계선이 있고, 저녁은 풀블리드라 경계선이 없다.
 *
 * 폭(W)은 두 비율 모두 1080 이라 글자 크기는 안 바꾸고 Y 좌표만 H 비율로 잡는다.
 */
const MORNING_SPLIT_RATIO = 0.665;
function morningSplitY(H: number): number {
  return Math.round(H * MORNING_SPLIT_RATIO);
}

/** 아침 블록·본문 좌우 여백 */
const MORNING_PAD = 72;
/** 아침 블록 바탕 */
const MORNING_BLOCK_BG = "#0b0d12";

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
 * 어절 단위로 줄을 나눈다.
 * 강조 조각 기준으로 자르면 `맨시티가` 가 `맨시티 / 가` 로 조사가 떨어져 나간다 —
 * 한국어에서 조사는 앞말에 붙여 쓴다.
 */
function wrapByWord(ctx: SKRSContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const word of text.split(" ")) {
    const test = cur ? `${cur} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = word;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * 강조 조각만 액센트 색으로 칠해 그린다.
 * `anchor` 는 align 이 "center" 면 중심 x, "left" 면 시작 x.
 */
function drawAccented(
  ctx: SKRSContext2D,
  text: string,
  accentPart: string,
  accentColor: string,
  anchor: number,
  y: number,
  align: "center" | "left" = "center",
): void {
  const prev = ctx.textAlign;
  ctx.textAlign = "left";

  if (!accentPart || !text.includes(accentPart)) {
    const x = align === "center" ? anchor - ctx.measureText(text).width / 2 : anchor;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, x, y);
    ctx.textAlign = prev;
    return;
  }

  const [head, tail] = text.split(accentPart);
  const hw = ctx.measureText(head).width;
  const aw = ctx.measureText(accentPart).width;
  const tw = ctx.measureText(tail).width;
  let x = align === "center" ? anchor - (hw + aw + tw) / 2 : anchor;

  ctx.fillStyle = "#ffffff";
  ctx.fillText(head, x, y);
  x += hw;
  ctx.fillStyle = accentColor;
  ctx.fillText(accentPart, x, y);
  x += aw;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(tail, x, y);
  ctx.textAlign = prev;
}

/**
 * title 카드 배경 PNG — 풀스크린 AI 이미지 + 어두운 vignette.
 * 텍스트는 renderReelTitleText()로 별도 PNG 생성 후 ffmpeg overlay에서 모션 적용.
 */
export async function renderReelTitleBackground(
  imagePath: string,
  aspect: ReelTitleAspect = "9:16",
  slot: PostSlot = "evening",
  opts: { noAiImage?: boolean; today?: string } = {},
): Promise<Buffer> {
  const { W, H } = aspectSize(aspect);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  if (opts.noAiImage) {
    const today = opts.today ?? "2026-01-01";
    drawSyntheticBackground(ctx, W, H, SLOT_ACCENT[slot], today);
    // 가운데를 히어로 경기의 팀 엠블럼으로 채운다 — 비-AI 이고, 매일 달라지고,
    // 정보 가치도 있다(그래디언트만 두면 가운데가 통째로 비어 저품질로 읽힌다).
    // best-effort: 엠블럼을 못 받으면 배경만 쓴다.
    await drawHeroEmblems(ctx, W, H, today).catch(() => {});
    return canvas.toBuffer("image/png");
  }

  if (slot === "morning") {
    // 아침 = 사진 + 솔리드 블록. 경계선이 저녁(풀블리드)과 갈리는 축이다.
    const split = morningSplitY(H);
    const img = await loadImage(imagePath);
    drawCover(ctx, img, 0, 0, W, split, 0.16);

    ctx.fillStyle = MORNING_BLOCK_BG;
    ctx.fillRect(0, split, W, H - split);
    ctx.fillStyle = SLOT_ACCENT.morning;
    ctx.fillRect(0, split, W, 5);

    // 경계 위쪽을 살짝 어둡게 — 사진이 밝은 컷이어도 선이 튀지 않는다
    const seam = ctx.createLinearGradient(0, split - 180, 0, split);
    seam.addColorStop(0, "rgba(11,13,18,0)");
    seam.addColorStop(1, "rgba(11,13,18,0.6)");
    ctx.fillStyle = seam;
    ctx.fillRect(0, split - 180, W, 180);

    // 상단 브랜드 가독성용
    const top = ctx.createLinearGradient(0, 0, 0, 260);
    top.addColorStop(0, "rgba(8,8,13,0.55)");
    top.addColorStop(1, "rgba(8,8,13,0)");
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, 260);

    return canvas.toBuffer("image/png");
  }

  const img = await loadImage(imagePath);
  drawCover(ctx, img, 0, 0, W, H, 0.32);

  // 상단 vignette (높이 상수 — 폭은 동일하므로 비율 무관)
  const topShade = ctx.createLinearGradient(0, 0, 0, 280);
  topShade.addColorStop(0, "rgba(8,8,13,0.60)");
  topShade.addColorStop(1, "rgba(8,8,13,0)");
  ctx.fillStyle = topShade;
  ctx.fillRect(0, 0, W, 280);

  // 하단 vignette — H의 약 43% (9:16 기준 820/1920 비율 유지)
  const vignetteHeight = Math.round(H * 0.427);
  const VIGNETTE_TOP = H - vignetteHeight;
  const vignette = ctx.createLinearGradient(0, VIGNETTE_TOP, 0, H);
  vignette.addColorStop(0, "rgba(8,8,13,0)");
  vignette.addColorStop(0.35, "rgba(8,8,13,0.55)");
  vignette.addColorStop(0.7, "rgba(8,8,13,0.82)");
  vignette.addColorStop(1, "rgba(8,8,13,0.95)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, VIGNETTE_TOP, W, vignetteHeight);

  return canvas.toBuffer("image/png");
}

/**
 * title 카드 텍스트 PNG — 투명 배경에 모든 텍스트 + 하단 한해설 로고.
 * ffmpeg overlay에서 페이드인/슬라이드 모션으로 합성하거나, renderReelTitleCard()로 합본.
 */
export async function renderReelTitleText(
  today: string,
  aspect: ReelTitleAspect = "9:16",
  opts: ReelBrandOpts = {},
): Promise<Buffer> {
  const noUrl = opts.noUrl ?? false;
  const { W, H } = aspectSize(aspect);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const slot = opts.slot ?? getPostSlot(today);
  const accent = SLOT_ACCENT[slot];
  const hook = buildCoverHook(today, slot);

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";

  // 텍스트 가독성용 약한 shadow
  ctx.shadowColor = "rgba(0,0,0,0.7)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;

  // 상단 브랜드
  ctx.fillStyle = accent;
  ctx.fillRect(60, 130 - 30, 6, 38);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 38px Pretendard";
  if (noUrl) {
    // 틱톡: URL 대신 한글 브랜드
    ctx.fillText("한해설", 80, 130);
  } else {
    ctx.fillText("haeseol", 80, 130);
    const haeW = ctx.measureText("haeseol").width;
    ctx.fillStyle = accent;
    ctx.fillText(".com", 80 + haeW, 130);
  }

  // ── 아침 = 하단 솔리드 블록 안, 좌측 정렬 · 세로 중앙 ──────────────
  // 저녁(풀블리드 중앙 정렬)과 구도부터 갈린다. 블록 안이라 shadow 는 필요 없다.
  if (slot === "morning") {
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.textAlign = "left";

    const split = morningSplitY(H);
    const maxW = W - MORNING_PAD * 2;
    const [, mMM, mDD] = today.split("-");
    const mDate = `${Number(mMM)}/${Number(mDD)}`;
    const mDow = `${dayOfWeekKr(today)}요일`;

    const bigSize = fitText(ctx, hook.big, maxW, 112, "900", 72);
    // 날짜(80) + 간격(76) + 작은 줄 + 간격(34) + 큰 줄
    const blockH = 80 + 76 + 46 + 34 + bigSize;
    let y = split + (H - split - blockH) / 2 + 80;

    ctx.font = "80px Anton";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(mDate, MORNING_PAD, y);
    const mDateW = ctx.measureText(mDate).width;
    ctx.font = "800 42px Pretendard";
    ctx.fillStyle = "rgba(255,255,255,0.58)";
    ctx.fillText(mDow, MORNING_PAD + mDateW + 18, y - 6);

    y += 76;
    const smallSize = fitText(ctx, hook.small, maxW, 46, "600", 34);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = `600 ${smallSize}px Pretendard`;
    ctx.fillText(hook.small, MORNING_PAD, y);

    y += 34 + bigSize;
    ctx.font = `900 ${bigSize}px Pretendard`;
    drawAccented(ctx, hook.big, hook.accent, accent, MORNING_PAD, y, "left");

    // 하단 우측 브랜드 — 저녁은 가운데 로고+텍스트라 여기서도 갈린다
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = "700 28px Pretendard";
    ctx.fillText(noUrl ? "한해설" : "haeseol.com", W - MORNING_PAD, H - 40);

    return canvas.toBuffer("image/png");
  }

  ctx.textAlign = "center";
  const centerX = W / 2;

  // 날짜 + 요일 (Anton 큰 숫자 + Pretendard 요일)
  const [, mm, dd] = today.split("-");
  const dow = dayOfWeekKr(today);
  const dateText = `${Number(mm)}/${Number(dd)}`;
  const dowText = `${dow}요일`;

  // y좌표는 9:16(H=1920) 기준 절대값을 H 비율로 환산해 4:5에서도 동일 비주얼 비율 유지
  const DATE_BASELINE = Math.round(H * 0.6875); // 9:16: 1320, 4:5: 928
  const BIG_Y = Math.round(H * 0.7813);          // 9:16: 1500, 4:5: 1055
  const SUB_Y = Math.round(H * 0.8333);          // 9:16: 1600, 4:5: 1125
  const LOGO_BASELINE = Math.round(H * 0.9375);  // 9:16: 1800, 4:5: 1266

  ctx.font = "160px Anton";
  const dateW = ctx.measureText(dateText).width;
  ctx.font = "800 96px Pretendard";
  const dowW = ctx.measureText(dowText).width;
  const gap = 28;
  const totalW = dateW + gap + dowW;
  const startX = (W - totalW) / 2;

  // 날짜는 흰색. 액센트 색은 후킹의 강조 조각에만 준다 —
  // 강조가 둘이면 시선이 갈려 어느 쪽도 안 읽힌다.
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "160px Anton";
  ctx.fillText(dateText, startX, DATE_BASELINE);
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = "800 96px Pretendard";
  ctx.fillText(dowText, startX + dateW + gap, DATE_BASELINE - 20);
  ctx.textAlign = "center";

  const drawBig = (text: string, y: number) => {
    const size = fitText(ctx, text, W - 120, 140, "900", 88);
    ctx.font = `900 ${size}px Pretendard`;
    const lines = wrapByWord(ctx, text, W - 120);
    let ly = y - (lines.length - 1) * (size + 12);
    for (const line of lines) {
      drawAccented(ctx, line, hook.accent, accent, centerX, ly);
      ly += size + 12;
    }
  };

  // 작은 줄도 액센트를 그린다. 저녁 풀 8번(`미리 알려드립니다` / `내일 {time} {who}`)처럼
  // 강조 조각이 작은 줄에 들어가는 템플릿이 있어서, 큰 줄만 처리하면 액센트가 안 보인다.
  const drawSmall = (text: string, y: number) => {
    const size = fitText(ctx, text, W - 160, 60, "600", 44);
    ctx.font = `600 ${size}px Pretendard`;
    if (hook.accent && text.includes(hook.accent) && !hook.big.includes(hook.accent)) {
      drawAccented(ctx, text, hook.accent, accent, centerX, y);
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(text, centerX, y);
    }
  };

  // 저녁 = 큰 줄 → 설명 줄 (아침은 위에서 이미 return 했다)
  drawBig(hook.big, BIG_Y);
  drawSmall(hook.small, SUB_Y);

  // 하단 — 한해설 로고 + haeseol.com (영상이라 스와이프 CTA는 의미 없음)
  const LOGO_SIZE = 88;
  const LOGO_GAP = 22;

  let logoImg = null;
  try {
    logoImg = await loadImage("assets/logo.png");
  } catch {
    // 로고 로드 실패 시 텍스트만
  }

  ctx.font = "900 64px Pretendard";
  const brandText = noUrl ? "한해설" : "haeseol.com";
  const brandW = ctx.measureText(brandText).width;
  const blockW = (logoImg ? LOGO_SIZE + LOGO_GAP : 0) + brandW;
  const blockStartX = (W - blockW) / 2;

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
  aspect: ReelTitleAspect = "9:16",
  opts: ReelBrandOpts = {},
): Promise<Buffer> {
  const { W, H } = aspectSize(aspect);
  const slot = opts.slot ?? getPostSlot(today);
  const bg = await renderReelTitleBackground(imagePath, aspect, slot, {
    noAiImage: opts.noAiImage,
    today,
  });
  const txt = await renderReelTitleText(today, aspect, opts);

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const bgImg = await loadImage(bg);
  ctx.drawImage(bgImg, 0, 0);
  const txtImg = await loadImage(txt);
  ctx.drawImage(txtImg, 0, 0);
  return canvas.toBuffer("image/png");
}
