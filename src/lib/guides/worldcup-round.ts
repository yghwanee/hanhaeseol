/**
 * 월드컵 토너먼트 라운드별 편성글 자동 생성 로직.
 *
 * worldcup.json 편성 데이터에서 "지금 다가오는 라운드"를 골라
 * 사람이 쓴 것처럼 읽히는 편성글(.md) 본문을 만든다. LLM 미사용.
 *
 * 톤은 docs/guide-style.md를 따른다(구어체·개인 반응, 줄표 금지, 표 1개).
 * 파일 IO/발행은 src/scripts/gen-worldcup-round-article.ts가 담당하고,
 * 여기서는 순수 함수만 둔다(테스트 가능하게).
 */

export interface WcSchedule {
  id: string;
  date: string; // YYYY-MM-DD (KST)
  time: string; // HH:MM (KST)
  sport: string;
  league: string; // "북중미 월드컵 16강" 등
  homeTeam: string;
  awayTeam: string;
  platform: string;
  koreanCommentary?: boolean;
  homeEmblem?: string;
  awayEmblem?: string;
}

const LEAGUE_PREFIX = "북중미 월드컵";

/** 결과·대진 데이터로 자동 판별하는 라운드 순서. 32강(예선 성격)은 자동 대상에서 제외. */
export const FULL_ROUND_ORDER = ["32강", "16강", "8강", "4강", "3·4위전", "결승"];
export const AUTO_ROUNDS = ["16강", "8강", "4강", "3·4위전", "결승"];

/** 라운드 → content-plan.md / 파일 slug. */
export const ROUND_SLUG: Record<string, string> = {
  "16강": "worldcup-round-of-16",
  "8강": "worldcup-quarterfinals",
  "4강": "worldcup-semifinals",
  "3·4위전": "worldcup-third-place",
  "결승": "worldcup-final",
};

export const DATA_START = "<!-- wc:data:start -->";
export const DATA_END = "<!-- wc:data:end -->";

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];
const UNDECIDED = "미정";

/** league 접미사에서 라운드 라벨 추출. 조별리그(접미사 없음)면 null. */
export function roundOf(s: WcSchedule): string | null {
  const label = s.league.replace(LEAGUE_PREFIX, "").trim();
  return label || null;
}

function isUndecided(team: string): boolean {
  return !team || team === UNDECIDED;
}

/** KST 기준 오늘 날짜(YYYY-MM-DD). */
export function kstTodayISO(now: Date = new Date()): string {
  return new Date(now.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/** YYYY-MM-DD 에 n일을 더한 YYYY-MM-DD. */
export function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** "7/5(일)" 형태. */
function dateLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}/${d}(${WEEKDAY[dow]})`;
}

function byDateTime(a: WcSchedule, b: WcSchedule): number {
  return (a.date + a.time).localeCompare(b.date + b.time);
}

export interface RoundTarget {
  round: string;
  matches: WcSchedule[]; // 날짜·시간 오름차순
}

/**
 * 오늘(KST) 기준 발행 대상 라운드를 고른다.
 * 규칙: 첫 경기 D-2 이내로 다가왔고 아직 마지막 경기가 안 지난, 가장 이른 라운드.
 * 대상 없으면 null(그날은 아무것도 안 함).
 */
export function selectTargetRound(
  schedules: WcSchedule[],
  todayISO: string,
): RoundTarget | null {
  for (const round of AUTO_ROUNDS) {
    const matches = schedules.filter((s) => roundOf(s) === round).sort(byDateTime);
    if (matches.length === 0) continue;
    const first = matches[0].date;
    const last = matches[matches.length - 1].date;
    if (todayISO >= addDays(first, -2) && todayISO <= last) {
      return { round, matches };
    }
  }
  return null;
}

function matchup(m: WcSchedule): string {
  return `${m.homeTeam || UNDECIDED} vs ${m.awayTeam || UNDECIDED}`;
}

function titleFor(round: string, single: boolean): string {
  return single
    ? `월드컵 ${round} 중계 총정리, 어디서 한국어 해설로 보나`
    : `월드컵 ${round} 일정·중계 총정리, 어디서 한국어 해설로 보나`;
}

function descriptionFor(round: string, n: number, single: boolean): string {
  return single
    ? `2026 북중미 월드컵 ${round} 대진과 한국시간, JTBC·치지직 중계, 한국어 해설·무료 여부를 한곳에 정리했습니다.`
    : `2026 북중미 월드컵 ${round} ${n}경기 대진과 한국시간, JTBC·치지직 중계, 한국어 해설·무료 여부를 한곳에 정리했습니다.`;
}

function keywordsFor(round: string): string {
  return `월드컵 ${round}, 월드컵 ${round} 일정, 월드컵 ${round} 중계, 월드컵 ${round} 채널, JTBC 월드컵, 치지직 월드컵, 월드컵 한국어 해설`;
}

/** 편성표 + 미정 안내(있으면). 이 구간만 갱신 시 교체된다. */
export function renderDataBlock(
  target: RoundTarget,
  schedules: WcSchedule[],
): string {
  const { round, matches } = target;

  const rows = matches
    .map((m) => `| ${dateLabel(m.date)} | ${m.time} | ${matchup(m)} | JTBC |`)
    .join("\n");
  const table = [
    "| 날짜 | 한국시간 | 대진 | 중계 |",
    "|---|---|---|---|",
    rows,
  ].join("\n");

  const undecided = matches.filter(
    (m) => isUndecided(m.homeTeam) || isUndecided(m.awayTeam),
  ).length;

  const parts = [table];
  if (undecided > 0) {
    const fi = FULL_ROUND_ORDER.indexOf(round);
    const feeder = fi > 0 ? FULL_ROUND_ORDER[fi - 1] : null;
    const feederMatches = feeder
      ? schedules.filter((s) => roundOf(s) === feeder)
      : [];
    const feederLast = feederMatches.length
      ? feederMatches.map((s) => s.date).sort().at(-1)!
      : null;
    if (feeder && feederLast) {
      parts.push(
        `표에서 상대가 '미정'인 경기가 ${undecided}개 보이죠. ` +
          `${feeder} 경기가 ${dateLabel(feederLast)}까지 이어져서 대진이 아직 다 안 나왔거든요. ` +
          `결과가 정해지는 대로 이 표도 채워서 업데이트할게요.`,
      );
    } else {
      parts.push(
        `아직 앞 라운드 결과가 안 나온 경기는 상대를 '미정'으로 뒀어요. ` +
          `정해지면 표에 바로 반영할게요.`,
      );
    }
  }

  return `${DATA_START}\n\n${parts.join("\n\n")}\n\n${DATA_END}`;
}

function introFor(target: RoundTarget, single: boolean): string {
  const { round, matches } = target;
  const first = matches[0];
  const firstLabel = dateLabel(first.date);

  if (single) {
    const decided = !isUndecided(first.homeTeam) && !isUndecided(first.awayTeam);
    if (round === "결승") {
      return decided
        ? `드디어 결승이에요. ${firstLabel} ${first.time}, ${matchup(first)} 단 한 경기로 이번 월드컵 우승팀이 갈립니다.`
        : `드디어 결승이에요. ${firstLabel} ${first.time}에 열려요. 어느 두 팀이 마지막 무대에 오를지는 4강 결과를 봐야 하고요.`;
    }
    return decided
      ? `${round}이에요. ${firstLabel} ${first.time}, ${matchup(first)} 한 경기가 열려요.`
      : `${round}이에요. ${firstLabel} ${first.time}에 열리는데, 대진은 앞 경기 결과가 나와야 확정돼요.`;
  }

  const firstDecided =
    !isUndecided(first.homeTeam) && !isUndecided(first.awayTeam);
  const opener = firstDecided
    ? `${firstLabel} ${first.time}에 ${matchup(first)} 경기로 시작해요.`
    : `${firstLabel} ${first.time}에 첫 경기가 시작해요.`;
  return (
    `${round} 대진이 나왔어요. 이번 라운드는 ${matches.length}경기고, ${opener}\n` +
    `토너먼트라 한 번 지면 그대로 짐 싸는 거니까, 여기서부터는 경기 하나하나가 진짜 무겁죠.`
  );
}

const WHERE_TO_WATCH =
  `중계는 이번에도 JTBC예요. 국내에선 JTBC가 북중미 월드컵을 독점 중계하고, 전 경기 한국어 해설이 붙어요.\n` +
  `TV로는 JTBC 채널에서 보면 되고, 폰이나 PC로는 치지직에서 실시간 중계를 무료로 볼 수 있어요. 네이버 아이디만 있으면 되고, 실시간은 따로 결제 안 해도 공짜예요. 경기 끝나고 풀 영상 다시보기는 네이버플러스 멤버십(월 4,900원)이 있어야 하고요. 이 부분은 [월드컵 무료로 보는 법](/guide/worldcup-free-streaming)에 더 자세히 정리해뒀어요.`;

const TIMING =
  `시간대는 좀 곤란해요. 미국에서 열리는 대회라 경기 대부분이 한국 새벽이거든요. 위 표에 한국시간으로 적어놨으니 시차 계산은 안 해도 돼요.\n` +
  `새벽 경기 챙기는 팁이랑 놓쳤을 때 다시보기는 [이 글](/guide/worldcup-late-night-viewing-tips)에 따로 적어놨어요. 실시간 편성이랑 결과는 [한해설 월드컵 페이지](https://haeseol.com/worldcup)에서 바로 확인할 수 있고요.`;

const CLOSING =
  `관심 있는 매치업 시간만 미리 체크해두면 돼요. 새벽 경기는 알림 걸어두는 게 안전하고요. 편성이 바뀌거나 대진이 확정되면 표에 바로 반영할게요.`;

export interface BuiltArticle {
  slug: string;
  markdown: string;
}

/** 신규 글 전체 마크다운을 만든다. */
export function buildArticle(
  target: RoundTarget,
  schedules: WcSchedule[],
  todayISO: string,
): BuiltArticle {
  const { round, matches } = target;
  const single = matches.length === 1;
  const slug = ROUND_SLUG[round];

  const frontmatter = [
    "---",
    `title: ${titleFor(round, single)}`,
    `description: ${descriptionFor(round, matches.length, single)}`,
    `date: ${todayISO}`,
    `updated: ${todayISO}`,
    "category: 월드컵",
    `keywords: ${keywordsFor(round)}`,
    "---",
  ].join("\n");

  const body = [
    introFor(target, single),
    WHERE_TO_WATCH,
    renderDataBlock(target, schedules),
    TIMING,
    CLOSING,
  ].join("\n\n");

  return { slug, markdown: `${frontmatter}\n\n${body}\n` };
}

/**
 * 이미 있는 글을 갱신한다. 마커 구간(편성표)만 새로 채우고 frontmatter updated만 바꾼다.
 * 도입/마무리 등 사람이 읽는 문단은 보존한다.
 * 마커가 없으면(사람이 손댄 옛 글 등) null 반환 → 건드리지 않음.
 * 내용 변화 없으면 null 반환 → 불필요 커밋 방지.
 */
export function refreshArticle(
  existing: string,
  target: RoundTarget,
  schedules: WcSchedule[],
  todayISO: string,
): string | null {
  const text = existing.replace(/\r\n/g, "\n");
  const start = text.indexOf(DATA_START);
  const end = text.indexOf(DATA_END);
  if (start === -1 || end === -1 || end < start) return null;

  const newBlock = renderDataBlock(target, schedules);
  let updated =
    text.slice(0, start) + newBlock + text.slice(end + DATA_END.length);
  updated = updated.replace(/^updated: .*$/m, `updated: ${todayISO}`);

  return updated === text ? null : updated;
}
