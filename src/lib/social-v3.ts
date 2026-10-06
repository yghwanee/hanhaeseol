// src/lib/social-v3.ts
//
// 소셜 v3 (2026-10-06 확정 디자인) — 렌더러(templates/social-v3/render.html)에 넘길 데이터.
// 1장 = 히어로 경기(밀어서 잠금해제) · 2장 = 그 경기 정보 · 3~4장 = 리그별 목록 · 마지막 = 한눈에.
// 시안: https://claude.ai/artifact/8ZsJ4Yh48zw2hy5eGdnuAG

import { buildListRows, type ListRow } from "./reel-list-card";
import { pickHeroForDate } from "./instagram";
import type { PostSlot } from "./post-slot";

export type V3Ball = "soccer" | "baseball" | "basketball" | "volleyball";

export type V3Slide =
  | { kind: "hero"; ball: V3Ball }
  | { kind: "match"; title: string; ball: V3Ball; matchup: string; time: string; platform: string }
  | { kind: "single"; title: string; ball: V3Ball; rows: V3Row[] }
  | { kind: "list"; title: string; ball: V3Ball; rows: V3Row[]; more: number }
  | { kind: "summary"; title: string; ball: V3Ball; rows: { time: string; sport: string; label: string }[] };

export interface V3Row {
  time: string;
  home: string;
  away: string;
  matchup: string;
  platform: string;
}

export interface V3Data {
  mast: string;
  dateLong: string;
  dateShort: string;
  hero: { home: string; away: string; league: string; when: string };
  slides: V3Slide[];
  color: { stub: string; acc: string; hero: string; bgA: string; bgB: string };
  photo: string | null;
  logo: string;
  noUrl: boolean;
}

/** 아침 = 진한 레드 · 저녁 = 일렉트릭 블루 (2026-10-06 확정). 대비 수치는 시안 페이지 참조. */
export const V3_COLORS: Record<PostSlot, V3Data["color"]> = {
  morning: { stub: "#D7102B", acc: "#C80F28", hero: "#FF6B7D", bgA: "#3a0b14", bgB: "#0c0d10" },
  evening: { stub: "#1F5BFF", acc: "#1A4FE0", hero: "#8FB2FF", bgA: "#0b1a45", bgB: "#0c0d10" },
};

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
export const MAX_LIST_ROWS = 5;

export function ballOf(sport?: string): V3Ball {
  if (sport === "야구") return "baseball";
  if (sport === "농구") return "basketball";
  if (sport === "배구") return "volleyball";
  return "soccer";
}

/** "19:30" → "저녁 7시 30분" */
export function spokenTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const part = h < 6 ? "새벽" : h < 11 ? "아침" : h < 17 ? "낮" : h < 21 ? "저녁" : "밤";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${part} ${h12}시${m ? ` ${m}분` : ""}`;
}

function toRow(r: ListRow): V3Row {
  const home = r.home ?? r.matchup.split(" vs ")[0];
  const away = r.away ?? r.matchup.split(" vs ")[1] ?? "";
  return { time: r.time, home, away, matchup: r.matchup, platform: r.platforms[0] ?? "" };
}

export function buildV3Data(
  today: string,
  slot: PostSlot,
  assets: { photo: string | null; logo: string; noUrl?: boolean },
): V3Data {
  const { rows } = buildListRows(today);
  if (rows.length === 0) throw new Error(`${today} 한국어 해설 경기가 없다 — v3 는 만들 게 없다`);

  const heroSched = pickHeroForDate(today);
  const heroRow = rows.find((r) => r.isHero) ?? rows[0];
  const heroHome = heroSched?.homeTeam ?? heroRow.home ?? heroRow.matchup;
  const heroAway = heroSched ? heroSched.awayTeam ?? "" : heroRow.away ?? "";
  const heroLeague = heroSched?.league ?? heroRow.league;
  const heroTime = heroRow.time;
  const heroPlatforms = heroRow.platforms;

  const [y, m, d] = today.split("-").map(Number);
  const dow = DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];

  const slides: V3Slide[] = [];
  const heroBall = ballOf(heroRow.sport);
  slides.push({ kind: "hero", ball: heroBall });
  slides.push({
    kind: "match",
    title: "경기 정보",
    ball: heroBall,
    matchup: heroAway ? `${heroHome} vs ${heroAway}` : heroHome,
    time: heroTime,
    platform: heroPlatforms.join(", "),
  });

  // 히어로를 뺀 나머지를 리그별로 묶는다. 경기 수가 많은 리그부터 두 묶음.
  const rest = rows.filter((r) => r !== heroRow);
  const groups = new Map<string, ListRow[]>();
  for (const r of rest) {
    const g = groups.get(r.league) ?? [];
    g.push(r);
    groups.set(r.league, g);
  }
  const ordered = [...groups.entries()].sort(
    (a, b) => b[1].length - a[1].length || a[1][0].time.localeCompare(b[1][0].time),
  );
  for (const [league, g] of ordered.slice(0, 2)) {
    const rs = g.map(toRow);
    const ball = ballOf(g[0].sport);
    if (rs.length === 1) {
      slides.push({ kind: "single", title: league, ball, rows: rs });
    } else {
      slides.push({
        kind: "list",
        title: `${league} ${rs.length}경기`,
        ball,
        rows: rs.slice(0, MAX_LIST_ROWS),
        more: Math.max(0, rs.length - MAX_LIST_ROWS),
      });
    }
  }

  // 한눈에: 히어로 포함 전체를 리그별로 묶어 시각순 넷까지. 경기가 하나뿐인 리그만 대진을 쓰되,
  // 길면(14자 초과) 리그 이름으로 줄인다 — 줄이지 않으면 폰에서 못 읽을 만큼 작아진다.
  const all = new Map<string, ListRow[]>();
  for (const r of rows) {
    const g = all.get(r.league) ?? [];
    g.push(r);
    all.set(r.league, g);
  }
  const items = [...all.entries()]
    .map(([league, g]) => ({
      time: g[0].time,
      sport: g[0].sport ?? "",
      label: g.length > 1 ? `${league} ${g.length}경기` : g[0].matchup.length <= 14 ? g[0].matchup : `${league} 1경기`,
    }))
    .sort((a, b) => a.time.localeCompare(b.time))
    .slice(0, 4);
  slides.push({
    kind: "summary",
    title: slot === "morning" ? "오늘 한눈에" : "내일 한눈에",
    ball: heroBall,
    rows: items,
  });

  return {
    mast: slot === "morning" ? "TODAY" : "TOMORROW",
    dateLong: `${m}월 ${d}일 ${dow}요일`,
    dateShort: `${String(m).padStart(2, "0")}.${String(d).padStart(2, "0")}`,
    hero: {
      home: heroHome,
      away: heroAway,
      league: heroLeague,
      when: `${spokenTime(heroTime)}, ${heroPlatforms[0] ?? ""}`.replace(/, $/, ""),
    },
    slides,
    color: V3_COLORS[slot],
    photo: assets.photo,
    logo: assets.logo,
    noUrl: assets.noUrl ?? false,
  };
}
