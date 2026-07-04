import { ImageResponse } from "next/og";
import fs from "node:fs";
import path from "node:path";
import scheduleData from "@/data/schedule.json";
import worldcupData from "@/data/worldcup.json";
import archiveData from "@/data/schedule-archive.json";
import { findMatchBySlug } from "@/lib/match-slug";
import type { Schedule, ScheduleData } from "@/types/schedule";

// fs 접근을 위해 Node 런타임. (Edge에서는 로컬 폰트 파일 읽기가 안 됨.)
export const runtime = "nodejs";
export const alt = "한해설 경기 중계 카드";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const data = scheduleData as unknown as ScheduleData;
const worldcup = worldcupData as unknown as ScheduleData;
const archive = archiveData as unknown as ScheduleData;

// 폰트/로고는 모듈 로드 시 1회만 읽는다(요청마다 재읽기 방지). process.cwd()는
// 빌드·런타임 모두 프로젝트 루트. templates/fonts 는 next.config outputFileTracingIncludes 로 번들 포함.
const FONT_BOLD = fs.readFileSync(
  path.join(process.cwd(), "templates/fonts/Pretendard-Bold.otf")
);
const FONT_REGULAR = fs.readFileSync(
  path.join(process.cwd(), "templates/fonts/Pretendard-Regular.otf")
);
const LOGO_DATA = `data:image/png;base64,${fs
  .readFileSync(path.join(process.cwd(), "public/logo.png"))
  .toString("base64")}`;

function findMatchAnywhere(slug: string): Schedule | undefined {
  return (
    findMatchBySlug(data.schedules, slug) ??
    findMatchBySlug(worldcup.schedules, slug) ??
    findMatchBySlug(archive.schedules, slug)
  );
}

// "2026-07-03" → "7월 3일"
function formatDate(iso: string): string {
  const m = /^\d{4}-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${Number(m[1])}월 ${Number(m[2])}일`;
}

type Badge = { label: string; color: string; bg: string; border: string };

function commentaryBadge(s: Schedule): Badge {
  if (s.koreanCommentary === true)
    return { label: "한국어 해설", color: "#4ade80", bg: "rgba(34,197,94,0.14)", border: "#22c55e" };
  if (s.koreanCommentary === false)
    return { label: "현지 해설", color: "#f87171", bg: "rgba(239,68,68,0.14)", border: "#ef4444" };
  return { label: "해설 확인중", color: "#fbbf24", bg: "rgba(245,158,11,0.14)", border: "#f59e0b" };
}

export default function Image({ params }: { params: { slug: string } }) {
  const match = findMatchAnywhere(params.slug);

  const badge = match ? commentaryBadge(match) : null;
  const league = match?.league ?? "";
  const home = match?.homeTeam ?? "";
  const away = match?.awayTeam ?? "";
  const metaLine = match
    ? `${formatDate(match.date)} ${match.time} KST · ${match.platform}`
    : "스포츠 한국어 해설 편성표";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          backgroundColor: "#0a0a0a",
          // satori는 radial-gradient의 `<size> at <pos>` 형태를 파싱 못 함.
          // `circle at <pos>` 형태만 지원하므로 이 문법을 쓴다.
          backgroundImage:
            "radial-gradient(circle at 25% 15%, #1e1b3a 0%, #0a0a0a 55%, #000000 100%)",
          fontFamily: "Pretendard",
          color: "#ffffff",
        }}
      >
        {/* 상단: 로고/워드마크 + 해설 뱃지 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO_DATA} width={68} height={68} alt="" />
            <span style={{ marginLeft: 20, fontSize: 40, fontWeight: 700 }}>한해설</span>
          </div>
          {badge && (
            <div
              style={{
                display: "flex",
                fontSize: 34,
                fontWeight: 700,
                color: badge.color,
                backgroundColor: badge.bg,
                border: `3px solid ${badge.border}`,
                borderRadius: 9999,
                padding: "14px 34px",
              }}
            >
              {badge.label}
            </div>
          )}
        </div>

        {/* 중앙: 리그 + 대진 */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {league !== "" && (
            <span style={{ fontSize: 36, color: "#a1a1aa", marginBottom: 18 }}>{league}</span>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", fontWeight: 700 }}>
            <span style={{ fontSize: 76, lineHeight: 1.1 }}>{home}</span>
            <span style={{ fontSize: 48, color: "#a855f7", padding: "0 26px", fontWeight: 400 }}>vs</span>
            <span style={{ fontSize: 76, lineHeight: 1.1 }}>{away}</span>
          </div>
        </div>

        {/* 하단: 일시·플랫폼 + 도메인 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 34, color: "#d4d4d8" }}>{metaLine}</span>
          <span style={{ fontSize: 28, color: "#71717a" }}>haeseol.com</span>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Pretendard", data: FONT_REGULAR, weight: 400, style: "normal" },
        { name: "Pretendard", data: FONT_BOLD, weight: 700, style: "normal" },
      ],
    }
  );
}
