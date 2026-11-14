import { ImageResponse } from "next/og";
import type { Schedule } from "@/types/schedule";
import { isBuildPhase, loadOgAssets } from "@/lib/og-assets";
import { OG_DEFAULT, findCurrentMatch, matchOgSlugs } from "@/lib/match-og";

/**
 * 매치 맞춤 OG 카드 (1200×630 PNG). **빌드 때만 굽는다** — 근거는 `@/lib/match-og` 머리 주석
 * (이슈 #96: Hobby Active CPU 초과로 계정 잠김, 12h CPU 1위가 런타임 OG 렌더).
 *
 * 매치 페이지는 구운 슬러그에만 이 주소를 건다(`matchOgImageUrl`). 그래도 목록 밖 요청이
 * 들어오면(빌드가 자정을 넘겨 워커끼리 창이 하루 어긋난 경우 등) 렌더 없이 기본 이미지로 보낸다.
 */
export const runtime = "nodejs";
export const dynamicParams = true;
export const revalidate = false;

const size = { width: 1200, height: 630 };

export function generateStaticParams(): { slug: string }[] {
  return [...matchOgSlugs()].map((slug) => ({ slug }));
}

/** 렌더 없이 기본 OG 로. 캐시를 실어 같은 URL 이 다시 함수를 깨우지 않게 한다. */
function toDefault(): Response {
  return new Response(null, {
    status: 307,
    headers: { Location: OG_DEFAULT, "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}

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

export async function GET(_req: Request, { params }: { params: { slug: string } }): Promise<Response> {
  // 🔴 런타임엔 절대 굽지 않는다. 빌드 중엔 날짜를 다시 보지 않는다 — 선별은
  // generateStaticParams 가 했고, 여기서 다시 보면 빌드가 KST 자정을 넘길 때 전날 경기가
  // 307 로 구워져 다음 배포까지 기본 카드로 나간다(2026-11-14 리뷰 지적).
  if (!isBuildPhase()) return toDefault();
  const match = findCurrentMatch(params.slug);
  if (!match) return toDefault();

  const { bold, regular, logo } = await loadOgAssets();
  const badge = commentaryBadge(match);
  const league = match.league;
  const home = match.homeTeam;
  const away = match.awayTeam;
  const metaLine = `${formatDate(match.date)} ${match.time} KST · ${match.platform}`;

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
          // `circle at <pos>` 형태만 지원한다.
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
            <img src={logo} width={68} height={68} alt="" />
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
            {away !== "" && (
              <span style={{ fontSize: 48, color: "#a855f7", padding: "0 26px", fontWeight: 400 }}>vs</span>
            )}
            {away !== "" && <span style={{ fontSize: 76, lineHeight: 1.1 }}>{away}</span>}
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
        { name: "Pretendard", data: regular, weight: 400, style: "normal" },
        { name: "Pretendard", data: bold, weight: 700, style: "normal" },
      ],
    }
  );
}
