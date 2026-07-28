import type { Schedule } from "@/types/schedule";
import { GAME_DURATION_HOURS, isGameFinished } from "@/lib/schedule-utils";

const SPORT_SCHEMA_MAP: Record<string, string> = {
  "축구": "Soccer",
  "야구": "Baseball",
  "농구": "Basketball",
  "배구": "Volleyball",
};

const MAX_EVENTS = 50;
// logo.png 원본은 3496x3496 / 1.26MB. 구조화 데이터 image 는 리그·플랫폼 페이지의 모든
// SportsEvent(최대 50개)에 붙으므로, 크롤러가 그 URL 을 받으면 1.26MB 다.
// 1200px 축소본(199KB)이면 구글 권장(1200px 이상)을 충족하면서 6.5배 가볍다.
const SITE_LOGO_URL = "https://haeseol.com/logo-1200.png";

function toKstIso(ms: number): string {
  // KST = UTC+9. ISO 8601 with explicit offset.
  const kstMs = ms + 9 * 60 * 60 * 1000;
  const d = new Date(kstMs);
  const yyyy = d.getUTCFullYear();
  const MM = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}:00+09:00`;
}

// BreadcrumbList 공용 빌더. league/platform 등 목록 페이지에서 재사용.
// 각 페이지가 인라인하던 패턴(match·guide·standings)을 목록 페이지로 확장.
export function buildBreadcrumbLd(
  items: { name: string; url: string }[]
): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  });
}

export function buildSportsEventLd(
  schedules: Schedule[],
  pageUrl: string
): string | null {
  const active = schedules
    .filter((s) => !isGameFinished(s.date, s.time, s.sport))
    .slice(0, MAX_EVENTS);

  if (active.length === 0) return null;

  const events = active.map((s) => {
    const [hh, mm] = s.time.split(":");
    const startDate = `${s.date}T${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:00+09:00`;

    const startMs = new Date(startDate).getTime();
    const durationHours = GAME_DURATION_HOURS[s.sport] ?? 3;
    const endDate = toKstIso(startMs + durationHours * 60 * 60 * 1000);

    const koreanCommentary = s.koreanCommentary === true;
    const description = `${s.league} ${s.homeTeam} vs ${s.awayTeam} ${koreanCommentary ? "한국어 해설" : "현지 해설"} 중계. ${s.platform}에서 ${s.date} ${s.time} KST 시작.`;

    // BroadcastEvent: SportsEvent 위에 "어디서 시청하는지"를 schema-level로 명시.
    // Google이 "Where to watch" 캐러셀(특히 sports vertical)에 노출할 신호.
    // 한해설의 핵심 가치 = 시청처 안내라 이 schema가 가장 잘 맞음.
    const broadcastEvent = {
      "@type": "BroadcastEvent",
      name: `${s.platform} 중계 — ${s.homeTeam} vs ${s.awayTeam}`,
      isLiveBroadcast: true,
      startDate,
      endDate,
      inLanguage: koreanCommentary ? "ko" : "en",
      publishedOn: {
        "@type": "BroadcastService",
        name: s.platform,
        broadcastDisplayName: s.platform,
        inLanguage: koreanCommentary ? "ko" : "en",
        areaServed: "KR",
        broadcaster: {
          "@type": "Organization",
          name: s.platform,
        },
      },
    };

    return {
      "@type": "SportsEvent",
      name: `${s.homeTeam} vs ${s.awayTeam}`,
      description,
      startDate,
      endDate,
      sport: SPORT_SCHEMA_MAP[s.sport] ?? "Sports",
      eventStatus: "https://schema.org/EventScheduled",
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      location: {
        "@type": "Place",
        name: `${s.homeTeam} 홈경기장`,
      },
      image: SITE_LOGO_URL,
      homeTeam: { "@type": "SportsTeam", name: s.homeTeam },
      awayTeam: { "@type": "SportsTeam", name: s.awayTeam },
      performer: [
        { "@type": "SportsTeam", name: s.homeTeam },
        { "@type": "SportsTeam", name: s.awayTeam },
      ],
      offers: {
        "@type": "Offer",
        url: pageUrl,
        availability: "https://schema.org/InStock",
        validFrom: startDate,
        category: s.platform,
      },
      broadcastChannel: s.platform,
      subEvent: broadcastEvent,
      inLanguage: koreanCommentary ? "ko" : "en",
    };
  });

  const ld = {
    "@context": "https://schema.org",
    "@graph": events,
  };

  return JSON.stringify(ld);
}
