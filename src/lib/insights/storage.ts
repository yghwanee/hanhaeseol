import fs from "node:fs";
import path from "node:path";
import type { MatchInsight } from "@/types/match-insight";

const INSIGHTS_DIR = path.join(process.cwd(), "src/data/match-insights");

export function insightFilePath(matchId: string): string {
  // Sanitize only the characters actually unsafe on Windows/Linux/macOS filesystems.
  // 이전엔 [^a-zA-Z0-9_-]를 전부 _로 바꿔서 한글이 다 똑같은 문자로 뭉개졌고, 같은
  // 날짜·시간·리그의 K리그2/KBO 경기 두 건이 동일 파일을 덮어쓰는 충돌이 발생했다.
  // 한글은 모든 주요 FS에서 안전하므로 그대로 두고, Windows 예약 문자만 치환한다.
  const safe = matchId.replace(/[:\\/?*<>|"]/g, "_").normalize("NFC");
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
