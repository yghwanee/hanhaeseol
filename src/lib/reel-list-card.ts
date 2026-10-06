// src/lib/reel-list-card.ts
//
// 릴스·쇼츠용 9:16 편성 목록 카드.
//
// 종전 영상은 인스타 캐러셀용 4:5 종목 카드(글자 36px)를 그대로 1080x1920 에 넣었다.
// 위아래 285px 씩 검은 띠가 생기고, 한 장에 5경기 × 2줄을 1.8초 동안 보여 줘서
// 폰 화면에서 읽을 수 없었다(2026-10-02 실제 업로드분 프레임 확인). 쇼츠 피드는
// 넘기지 않고 본 비율로 다음 노출을 정하는데, 읽을 수 없는 화면은 넘길 이유가 된다.
//
// 여기서는 세로 화면을 통째로 쓰고 글자를 키운다(시각 76px · 매치업 최대 60px).
// 쇼츠·릴스 UI 가 아래쪽과 오른쪽을 덮으므로 본문은 그 안쪽에만 둔다.

import { createCanvas, type SKRSContext2D } from "@napi-rs/canvas";
import type { Schedule } from "@/types/schedule";
import { compareHero } from "./hero-pick";
import { loadKoreanMatchesAll, pickHeroForDate, recentHeroTeams } from "./instagram";

const W = 1080;
const H = 1920;
const PAD_X = 72;
/** 오른쪽 버튼 열(좋아요·댓글·공유)이 덮는 폭. 본문은 여기까지 안 간다. */
const RIGHT_SAFE = 150;
const KST_DOW = ["일", "월", "화", "수", "목", "금", "토"];

/** 한 장에 올리는 경기 수. 6 이상이면 아래쪽 UI(제목·채널명)에 마지막 줄이 깔린다. */
export const LIST_PER_CARD = 5;
/** 영상에 넣는 목록 카드 수 상한. 넘는 경기는 "+N경기"로만 알린다. */
export const LIST_MAX_CARDS = 2;

export interface ListRow {
  time: string;
  matchup: string;
  league: string;
  platforms: string[];
  isHero: boolean;
  /** 종목 (소셜 v3 가 장마다 공 모양을 고를 때 쓴다) */
  sport?: string;
  home?: string;
  away?: string;
}

const norm = (s: string) => s.replace(/\s+/g, "");

/** 같은 팀의 다른 표기인가 — 완전 일치이거나 한쪽이 다른 쪽의 꼬리(`창원 LG` ↔ `LG`). */
function sameSide(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return x === y;
  return x === y || x.endsWith(y) || y.endsWith(x);
}

/**
 * 같은 경기가 플랫폼마다 한 줄씩 들어 있다(KBO 는 티빙 + 케이블 = 두 줄, 시각도 5~20분 차).
 * 그대로 그리면 다섯 줄 중 두세 줄이 같은 경기다. 경기 단위로 접고 플랫폼을 모은다.
 */
export function buildListRows(today: string): {
  rows: ListRow[];
  /** 접은 뒤의 경기 수 — "+N경기 더" 계산용 */
  total: number;
  /** 접기 전 편성 줄 수. 제목·캡션의 "한국어 해설 N경기"와 같은 숫자여야 한다. */
  listings: number;
} {
  const matches = loadKoreanMatchesAll(today);
  const recent = recentHeroTeams(today);
  const hero = pickHeroForDate(today);
  const ranked = [...matches].sort((a, b) => compareHero(a, b, recent));

  const byGame = new Map<string, { first: Schedule; platforms: string[]; time: string }>();
  for (const m of ranked) {
    const exact = `${m.sport}|${norm(m.homeTeam)}|${norm(m.awayTeam ?? "")}`;
    // 플랫폼마다 팀 표기가 갈린다(`부산 KCC vs 창원 LG` ↔ `KCC vs LG`). 같은 종목에서
    // 두 팀 다 한쪽이 다른 쪽의 꼬리면 같은 경기로 본다 — 먼저 들어온(주목도 높은) 표기를 쓴다.
    const key =
      [...byGame.keys()].find((k) => {
        const g = byGame.get(k)!.first;
        return (
          g.sport === m.sport &&
          sameSide(g.homeTeam, m.homeTeam) &&
          sameSide(g.awayTeam ?? "", m.awayTeam ?? "")
        );
      }) ?? exact;
    const hit = byGame.get(key);
    if (hit) {
      if (!hit.platforms.includes(m.platform)) hit.platforms.push(m.platform);
      if (m.time < hit.time) hit.time = m.time;
    } else {
      byGame.set(key, { first: m, platforms: [m.platform], time: m.time });
    }
  }

  const games = [...byGame.values()];
  const picked = games.slice(0, LIST_PER_CARD * LIST_MAX_CARDS);
  const rows = picked
    .map((g) => ({
      time: g.time,
      matchup: g.first.awayTeam ? `${g.first.homeTeam} vs ${g.first.awayTeam}` : g.first.homeTeam,
      league: g.first.league,
      platforms: g.platforms,
      sport: g.first.sport,
      home: g.first.homeTeam,
      away: g.first.awayTeam ?? undefined,
      isHero:
        hero !== null &&
        g.first.sport === hero.sport &&
        sameSide(g.first.homeTeam, hero.homeTeam) &&
        sameSide(g.first.awayTeam ?? "", hero.awayTeam ?? ""),
    }))
    // 주목도 순으로 **고른** 뒤 시각 순으로 **보여 준다** — 편성표는 시간순이 읽기 쉽다.
    .sort((a, b) => a.time.localeCompare(b.time));

  return { rows, total: games.length, listings: matches.length };
}

function fitFont(
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number,
  base: number,
  weight: string,
  min: number,
): number {
  let size = base;
  ctx.font = `${weight} ${size}px Pretendard`;
  while (ctx.measureText(text).width > maxWidth && size > min) {
    size -= 2;
    ctx.font = `${weight} ${size}px Pretendard`;
  }
  return size;
}

/** 폭을 넘으면 말줄임. 최소 글자 크기에서도 넘는 긴 팀명 조합용. */
function ellipsize(ctx: SKRSContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1);
  return `${s}…`;
}

function dateLabel(today: string): { date: string; dow: string } {
  const [y, m, d] = today.split("-").map(Number);
  const dow = KST_DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return { date: `${m}/${d}`, dow: `${dow}요일` };
}

function hexWithAlpha(hex: string, alpha: number): string {
  const n = Number.parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export interface ReelListOpts {
  /** 슬롯 액센트(아침 앰버 / 저녁 라임). */
  accent: string;
  /** 틱톡판 — URL 대신 브랜드 검색 유도. */
  noUrl?: boolean;
}

/**
 * 그날 한국어 해설 경기를 9:16 목록 카드 1~2장으로 그린다. 경기가 없으면 빈 배열.
 */
export function renderReelListCards(today: string, opts: ReelListOpts): Buffer[] {
  const { rows, total, listings } = buildListRows(today);
  if (rows.length === 0) return [];

  const pages: ListRow[][] = [];
  for (let i = 0; i < rows.length; i += LIST_PER_CARD) pages.push(rows.slice(i, i + LIST_PER_CARD));

  const { date, dow } = dateLabel(today);
  const shown = rows.length;
  const accent = opts.accent;

  return pages.map((page, pageIdx) => {
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext("2d");

    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#08080d");
    bg.addColorStop(0.55, "#0f0f1e");
    bg.addColorStop(1, "#1a1a2e");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const glow = ctx.createRadialGradient(W * 0.2, H * 0.1, 0, W * 0.2, H * 0.1, 760);
    glow.addColorStop(0, hexWithAlpha(accent, 0.18));
    glow.addColorStop(1, hexWithAlpha(accent, 0));
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";

    // 머리 — 날짜 + "한국어 해설 N경기"
    ctx.fillStyle = "#ffffff";
    ctx.font = "150px Anton";
    ctx.fillText(date, PAD_X, 330);
    const dateW = ctx.measureText(date).width;
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "800 64px Pretendard";
    ctx.fillText(dow, PAD_X + dateW + 26, 318);

    ctx.fillStyle = accent;
    ctx.font = "900 62px Pretendard";
    ctx.fillText(`한국어 해설 ${listings}경기`, PAD_X, 430);
    if (pages.length > 1) {
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "700 40px Pretendard";
      ctx.fillText(`${pageIdx + 1} / ${pages.length}`, W - RIGHT_SAFE, 424);
      ctx.textAlign = "left";
    }

    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(PAD_X, 476, W - PAD_X - RIGHT_SAFE, 2);

    // 본문 — 시각(좌) + 매치업·리그·플랫폼(우)
    const ROW_TOP = 500;
    const ROW_H = 196;
    const TIME_W = 232;
    const textX = PAD_X + TIME_W;
    const textMax = W - RIGHT_SAFE - textX;

    page.forEach((r, i) => {
      const top = ROW_TOP + i * ROW_H;

      if (r.isHero) {
        ctx.fillStyle = hexWithAlpha(accent, 0.1);
        ctx.fillRect(PAD_X - 24, top + 10, W - RIGHT_SAFE - PAD_X + 48, ROW_H - 20);
        ctx.fillStyle = accent;
        ctx.fillRect(PAD_X - 24, top + 10, 8, ROW_H - 20);
      }

      ctx.fillStyle = accent;
      ctx.font = "76px Anton";
      ctx.fillText(r.time, PAD_X, top + 118);

      ctx.fillStyle = "#ffffff";
      const size = fitFont(ctx, r.matchup, textMax, 60, "800", 40);
      ctx.font = `800 ${size}px Pretendard`;
      ctx.fillText(ellipsize(ctx, r.matchup, textMax), textX, top + 92);

      ctx.fillStyle = "rgba(255,255,255,0.68)";
      ctx.font = "600 38px Pretendard";
      const sub = `${r.league} · ${r.platforms.join(" · ")}`;
      ctx.fillText(ellipsize(ctx, sub, textMax), textX, top + 150);
    });

    // 꼬리 — 영상에 못 실은 경기 수 + 어디서 다 보는지
    const more = total - shown;
    const isLast = pageIdx === pages.length - 1;
    const tailY = ROW_TOP + LIST_PER_CARD * ROW_H + 86;
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.font = "700 44px Pretendard";
    const site = opts.noUrl ? "한해설 검색" : "haeseol.com";
    const tail = isLast && more > 0 ? `+ ${more}경기 더 · ${site}` : `전체 편성 · ${site}`;
    ctx.fillText(tail, PAD_X, tailY);

    return canvas.toBuffer("image/png");
  });
}
