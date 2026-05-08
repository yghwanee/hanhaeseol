import type { Schedule } from "@/types/schedule";
import { isGameFinished } from "@/lib/schedule-utils";

const SPORT_SCHEMA_MAP: Record<string, string> = {
  "축구": "Soccer",
  "야구": "Baseball",
  "농구": "Basketball",
  "배구": "Volleyball",
};

const MAX_EVENTS = 50;

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

    return {
      "@type": "SportsEvent",
      name: `${s.homeTeam} vs ${s.awayTeam}`,
      startDate,
      sport: SPORT_SCHEMA_MAP[s.sport] ?? "Sports",
      homeTeam: { "@type": "SportsTeam", name: s.homeTeam },
      awayTeam: { "@type": "SportsTeam", name: s.awayTeam },
      location: {
        "@type": "VirtualLocation",
        url: pageUrl,
      },
      eventStatus: "https://schema.org/EventScheduled",
      broadcastChannel: s.platform,
      inLanguage: s.koreanCommentary === true ? "ko" : "en",
      organizer: {
        "@type": "Organization",
        name: s.league,
      },
    };
  });

  const ld = {
    "@context": "https://schema.org",
    "@graph": events,
  };

  return JSON.stringify(ld);
}
