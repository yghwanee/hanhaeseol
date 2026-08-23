/**
 * 생성문에서 "팀 흐름" 주장이 실제 전적과 어긋나는지 검사한다.
 *
 * 🔴 왜 필요한가 (2026-08-23):
 * 프롬프트에 "streak 방향에만 일치하게 쓰라"고 적어 뒀는데도 모델이 반대로 썼다.
 * 저장된 인사이트를 훑어보니 111건 중 30건이 의심 — 실제 예:
 *   - 보스턴 레드삭스 최근 5경기 WWLWW(2연승) → "연패를 기록하며 분위기 전환이 필요"
 *   - 미네소타 트윈스 LLWWW(2연패)          → "직전 경기 승리로 상승세"
 * 부탁으로는 안 막힌다. 생성 후 기계로 검사해서 틀리면 버린다.
 */

export type Flow = "up" | "down" | "flat" | "unknown";

/** 최근 5경기 문자열은 왼쪽이 최신이다(team-records 크롤이 종목별 방향을 통일해 둔다). */
export function deriveFlow(
  last5?: string | null,
  streak?: { type: "W" | "L" | "D"; count: number } | null,
): Flow {
  if (streak && streak.count > 0) {
    if (streak.type === "W") return "up";
    if (streak.type === "L") return "down";
    return "flat";
  }
  const first = last5?.[0];
  if (first === "W") return "up";
  if (first === "L") return "down";
  if (first === "D") return "flat";
  return "unknown";
}

/** 최근 5경기 문자열에서 연속 기록을 뽑는다. 네이버가 안 주는 리그(EPL·라리가 등) 대비. */
export function streakFromLast5(
  last5?: string | null,
): { type: "W" | "L" | "D"; count: number } | undefined {
  if (!last5) return undefined;
  const head = last5[0];
  if (head !== "W" && head !== "L" && head !== "D") return undefined;
  let count = 1;
  for (let i = 1; i < last5.length; i++) {
    if (last5[i] !== head) break;
    count++;
  }
  return { type: head, count };
}

// 상승 주장. "연승"·"상승세"처럼 방향이 분명한 표현만 넣는다.
const UP_PATTERNS: RegExp[] = [
  /연승/,
  /상승세/,
  /승승장구/,
  /무패/,
  /파죽/,
  /물오른/,
  /상승 ?곡선/,
  /좋은 흐름/,
  /흐름이 좋/,
  /순항/,
  /기세를 (올리|이어)/,
  /승리를 거두며/,
  /직전 경기 승리/,
];

// 하락 주장. "반등"·"분위기 전환"은 뒤에 오는 말까지 봐야 방향이 정해진다
// ("반등에 성공"은 상승 쪽이라 여기 넣으면 오탐이 난다).
const DOWN_PATTERNS: RegExp[] = [
  /연패/,
  /하락세/,
  /내림세/,
  /부진/,
  /침체/,
  /주춤/,
  /흐름이 (꺾|좋지 ?않)/,
  /아쉬운 (흐름|결과)/,
  /반등(이|을)? ?(필요|절실|노리|노려|모색|시급)/,
  /분위기 (전환|반전)(이|을)? ?(필요|절실|노리|노려|모색|시급|위한)/,
  /흔들리/,
];

function claimOf(sentence: string): "up" | "down" | null {
  const up = UP_PATTERNS.some((r) => r.test(sentence));
  const down = DOWN_PATTERNS.some((r) => r.test(sentence));
  // 한 문장이 두 방향을 다 담으면(예: "부진을 씻고 연승") 판정하지 않는다.
  if (up === down) return null;
  return up ? "up" : "down";
}

export interface TeamFlow {
  name: string;
  flow: Flow;
}

export interface FormContradiction {
  team: string;
  claimed: "up" | "down";
  actual: Flow;
  sentence: string;
}

/**
 * 문장 단위로 훑으면서 "그 문장의 주어 팀"이 어느 쪽으로 서술됐는지 본다.
 * 팀명이 없는 문장은 직전 문장의 주어를 이어받는다(한국어 글은 주어를 계속 안 쓴다).
 * 두 팀이 함께 나오는 문장은 누구 얘기인지 갈리지 않으므로 건너뛴다.
 */
export function findFormContradictions(
  text: string,
  teams: TeamFlow[],
): FormContradiction[] {
  const known = teams.filter((t) => t.flow === "up" || t.flow === "down");
  if (known.length === 0) return [];

  const out: FormContradiction[] = [];
  let subject: TeamFlow | null = null;

  for (const sentence of text.split(/(?<=[.!?。…])\s+|\n+/)) {
    if (!sentence.trim()) continue;
    const mentioned = teams.filter((t) => sentence.includes(t.name));
    if (mentioned.length > 1) {
      subject = null; // 두 팀이 같이 나오면 주어가 흐려진다
      continue;
    }
    if (mentioned.length === 1) subject = mentioned[0];
    if (!subject) continue;
    if (subject.flow !== "up" && subject.flow !== "down") continue;

    const claimed = claimOf(sentence);
    if (!claimed) continue;
    if (claimed !== subject.flow) {
      out.push({ team: subject.name, claimed, actual: subject.flow, sentence: sentence.trim() });
    }
  }
  return out;
}
