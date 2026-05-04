import type { Schedule } from "@/types/schedule";
import { isGameFinished, formatDateHeader } from "@/lib/schedule-utils";

const HOUR_BUCKETS: { hour: (h: number) => boolean; label: (h: number) => string }[] = [
  { hour: (h) => h === 0, label: () => "자정" },
  { hour: (h) => h >= 1 && h <= 5, label: (h) => `새벽 ${h}시` },
  { hour: (h) => h >= 6 && h <= 11, label: (h) => `오전 ${h}시` },
  { hour: (h) => h === 12, label: () => "정오" },
  { hour: (h) => h >= 13 && h <= 17, label: (h) => `오후 ${h - 12}시` },
  { hour: (h) => h >= 18 && h <= 23, label: (h) => `저녁 ${h - 12}시` },
];

export function formatNaturalTime(time: string): string {
  const [hhStr, mmStr] = time.split(":");
  const hh = Number(hhStr);
  const mm = Number(mmStr);
  const bucket = HOUR_BUCKETS.find((b) => b.hour(hh));
  const base = bucket ? bucket.label(hh) : `${hh}시`;
  if (mm === 0) return base;
  if (hh === 0 || hh === 12) return `${base} ${mm}분`;
  return `${base} ${mm}분`;
}

function commentaryPhrase(kc: Schedule["koreanCommentary"]): string {
  if (kc === true) return "한국어 해설로";
  if (kc === false) return "현지 해설로";
  return "";
}

export function describeMatch(s: Schedule): string {
  const day = formatDateHeader(s.date);
  const time = formatNaturalTime(s.time);
  const versus = s.awayTeam ? `${s.homeTeam} vs ${s.awayTeam}` : s.homeTeam;
  const kc = commentaryPhrase(s.koreanCommentary);
  const platform = s.platform;
  if (kc) {
    return `${day} ${time}, ${versus} 경기가 ${platform}에서 ${kc} 중계됩니다.`;
  }
  return `${day} ${time}, ${versus} 경기가 ${platform}에서 중계됩니다.`;
}

type PickOptions = {
  league?: string[];
  platform?: string[];
  preferKorean?: boolean;
  max?: number;
};

export function pickWeekHighlights(
  schedules: Schedule[],
  opts: PickOptions = {}
): Schedule[] {
  const { league, platform, preferKorean = true, max = 5 } = opts;

  const filtered = schedules.filter((s) => {
    if (isGameFinished(s.date, s.time, s.sport)) return false;
    if (league && !league.includes(s.league)) return false;
    if (platform && !platform.includes(s.platform)) return false;
    return true;
  });

  const seenMatchups = new Set<string>();
  const dedup: Schedule[] = [];
  for (const s of [...filtered].sort((a, b) =>
    a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)
  )) {
    const key = `${s.date}|${s.league}|${s.homeTeam}|${s.awayTeam}`;
    if (seenMatchups.has(key)) continue;
    seenMatchups.add(key);
    dedup.push(s);
  }

  const sorted = [...dedup].sort((a, b) => {
    if (preferKorean) {
      const aKo = a.koreanCommentary === true ? 0 : a.koreanCommentary === "unknown" ? 1 : 2;
      const bKo = b.koreanCommentary === true ? 0 : b.koreanCommentary === "unknown" ? 1 : 2;
      if (aKo !== bKo) return aKo - bKo;
    }
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });

  return sorted.slice(0, max);
}
