import { ImageResponse } from "next/og";
import scheduleData from "@/data/schedule.json";
import worldcupData from "@/data/worldcup.json";
import { findMatchBySlug } from "@/lib/match-slug";
import type { Schedule, ScheduleData } from "@/types/schedule";

export const runtime = "nodejs";
export const alt = "한해설 경기 중계 카드";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const data = scheduleData as unknown as ScheduleData;
const worldcup = worldcupData as unknown as ScheduleData;

const BASE = "https://haeseol.com";

// 폰트/로고는 서버리스 번들 파일 트레이싱(fs)에 의존하면 프로덕션에서 파일 누락으로
// 500 이 난다. 대신 배포된 public 자산을 HTTPS 로 가져온다. 모듈 스코프에서 1회 메모.
let assetsPromise: Promise<{
  bold: ArrayBuffer;
  regular: ArrayBuffer;
  logo: string;
}> | null = null;

function loadAssets() {
  if (!assetsPromise) {
    assetsPromise = (async () => {
      // 배포마다 거의 안 바뀌는 에셋이라 캐시가 이득이지만, Data Cache 는
      // 배포 간에도 유지되므로 force-cache 로 두면 로고를 교체해도 옛 게
      // 영구히 박힌다(아이콘을 75% 로 줄인 전례 있음). 하루로 묶는다.
      const [bold, regular, logoBuf] = await Promise.all([
        fetch(`${BASE}/fonts/Pretendard-Bold.otf`, { next: { revalidate: 86400 } }).then((r) =>
          r.arrayBuffer(),
        ),
        fetch(`${BASE}/fonts/Pretendard-Regular.otf`, { next: { revalidate: 86400 } }).then((r) =>
          r.arrayBuffer(),
        ),
        // 원본(1.26MB) 대신 1200px 축소본(199KB). OG 렌더마다 받는 바이트라 6.5배 차이가 난다.
        fetch(`${BASE}/logo-1200.png`, { next: { revalidate: 86400 } }).then((r) => r.arrayBuffer()),
      ]);
      const logo = `data:image/png;base64,${Buffer.from(logoBuf).toString("base64")}`;
      return { bold, regular, logo };
    })();
  }
  return assetsPromise;
}

/**
 * 🔴 아카이브 경기는 맞춤 카드를 굽지 않고 기본 OG 로 보낸다 (2026-09-16).
 *
 * 종전엔 현재 편성에서 못 찾으면 `schedule-archive.json`(978KB, 영구 누적)을 받아
 * 거기서 찾아 카드를 그렸다. 아카이브가 3,179건이라 **슬러그 하나당 satori 렌더 한 번**이
 * 붙고, 그렇게 구운 PNG 가 전부 Origin Transfer 로 나간다.
 * 2026-08-24 robots 주석 실측: Active CPU 최상위가 `/match/[slug]` 38분 +
 * `/match/[slug]/opengraph-image` 17분이었다.
 *
 * 지난 경기 카드가 공유되는 일은 사실상 없다 — 공유는 경기 전후 하루에 몰린다.
 * 그 구간은 `schedule.json`(7일치)·`worldcup.json` 에 그대로 있으므로 맞춤 카드가 나온다.
 * 아카이브로 넘어간 경기만 기본 이미지로 접는다.
 */
function findCurrentMatch(slug: string): Schedule | undefined {
  return findMatchBySlug(data.schedules, slug) ?? findMatchBySlug(worldcup.schedules, slug);
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

export default async function Image({ params }: { params: { slug: string } }) {
  const match = findCurrentMatch(params.slug);
  // 아카이브 경기·해석 불가 슬러그는 정적 PNG 로 보낸다. 여기서 끊어야 폰트·로고 fetch 와
  // satori 렌더가 아예 안 돈다(위 주석 참조).
  if (!match) return Response.redirect(`${BASE}/og-default.png`, 308);

  const { bold, regular, logo } = await loadAssets();
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
