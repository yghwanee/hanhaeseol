import fs from "node:fs";
import path from "node:path";
import { insightFilePath } from "@/lib/insights/storage";
import type { MatchInsight } from "@/types/match-insight";

/**
 * 일회성 마이그레이션:
 *   - 이전 sanitize 룰(`[^a-zA-Z0-9_-] → _`)이 한글을 다 같은 문자로 뭉개서
 *     5/25 16:30 K리그2 수원-천안 / 파주-김포 같은 동일 시간대 경기 두 건이
 *     동일 파일명으로 충돌했다.
 *   - 새 룰은 Windows 예약 문자만 치환하고 한글을 보존하므로 충돌이 사라진다.
 *   - 기존 파일 내부에는 원본 matchId가 들어 있으므로, 그 값으로 새 파일명을
 *     계산해 rename. 덮어써진 파일은 살아남은 matchId 하나만 복원되고,
 *     사라진 인사이트는 다음 cron에서 자동 재생성된다.
 */
const INSIGHTS_DIR = path.join(process.cwd(), "src/data/match-insights");

function main() {
  if (!fs.existsSync(INSIGHTS_DIR)) {
    console.log("[migrate] insights dir not found, nothing to do");
    return;
  }

  const files = fs.readdirSync(INSIGHTS_DIR).filter((f) => f.endsWith(".json"));
  let renamed = 0;
  let unchanged = 0;
  let removed = 0;
  let broken = 0;

  for (const f of files) {
    const oldPath = path.join(INSIGHTS_DIR, f);
    let parsed: MatchInsight;
    try {
      parsed = JSON.parse(fs.readFileSync(oldPath, "utf-8")) as MatchInsight;
    } catch {
      console.warn(`  ! ${f} — JSON parse failed, removing`);
      fs.unlinkSync(oldPath);
      broken++;
      continue;
    }
    if (typeof parsed.matchId !== "string" || parsed.matchId.length === 0) {
      console.warn(`  ! ${f} — no matchId, removing`);
      fs.unlinkSync(oldPath);
      broken++;
      continue;
    }
    const newPath = insightFilePath(parsed.matchId);
    if (newPath === oldPath) {
      unchanged++;
      continue;
    }
    if (fs.existsSync(newPath)) {
      // 새 룰로 이미 같은 파일이 있다는 건 다른 변종이 먼저 옮겨졌단 뜻 — 중복 제거.
      console.warn(`  ! ${f} → already exists at ${path.basename(newPath)}, removing old`);
      fs.unlinkSync(oldPath);
      removed++;
      continue;
    }
    fs.renameSync(oldPath, newPath);
    console.log(`  ✓ ${f} → ${path.basename(newPath)}`);
    renamed++;
  }

  console.log(
    `[migrate] done — renamed=${renamed} unchanged=${unchanged} removed=${removed} broken=${broken}`,
  );
}

main();
