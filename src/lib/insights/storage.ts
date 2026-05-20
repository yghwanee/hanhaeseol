import fs from "node:fs";
import path from "node:path";
import type { MatchInsight } from "@/types/match-insight";

const INSIGHTS_DIR = path.join(process.cwd(), "src/data/match-insights");

export function insightFilePath(matchId: string): string {
  // matchId may contain characters unsafe for filenames on some FS;
  // sanitize to alphanumerics + dash/underscore.
  const safe = matchId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(INSIGHTS_DIR, `${safe}.json`);
}

export function readInsight(matchId: string): MatchInsight | null {
  const filePath = insightFilePath(matchId);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as MatchInsight;
  } catch {
    return null;
  }
}

export function writeInsight(insight: MatchInsight): void {
  if (!fs.existsSync(INSIGHTS_DIR)) {
    fs.mkdirSync(INSIGHTS_DIR, { recursive: true });
  }
  const filePath = insightFilePath(insight.matchId);
  fs.writeFileSync(filePath, JSON.stringify(insight, null, 2) + "\n", "utf-8");
}
