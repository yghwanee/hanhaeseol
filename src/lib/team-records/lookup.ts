import type { TeamRecord, TeamRecordsMap } from "@/types/team-record";

const CLUB_DESIGNATIONS = ["AS", "AC", "RB", "FC", "SC", "CF", "SV", "TSG"];

function normalize(name: string): string {
  let s = name.trim();
  for (const tag of CLUB_DESIGNATIONS) {
    s = s.replace(new RegExp(`(^|\\s)${tag}(\\s|$)`, "g"), " ");
  }
  return s.replace(/\s+/g, "").toLowerCase();
}

const indexCache = new WeakMap<object, Map<string, Map<string, TeamRecord>>>();

function getNormalizedIndex(records: TeamRecordsMap): Map<string, Map<string, TeamRecord>> {
  const cached = indexCache.get(records);
  if (cached) return cached;
  const idx = new Map<string, Map<string, TeamRecord>>();
  for (const [league, teams] of Object.entries(records)) {
    const inner = new Map<string, TeamRecord>();
    for (const [team, rec] of Object.entries(teams)) {
      const key = normalize(team);
      if (key && !inner.has(key)) inner.set(key, rec);
    }
    idx.set(league, inner);
  }
  indexCache.set(records, idx);
  return idx;
}

export function lookupTeamRecord(
  records: TeamRecordsMap,
  league: string,
  team: string,
): TeamRecord | undefined {
  const direct = records[league]?.[team];
  if (direct) return direct;
  const norm = normalize(team);
  if (!norm) return undefined;
  return getNormalizedIndex(records).get(league)?.get(norm);
}
