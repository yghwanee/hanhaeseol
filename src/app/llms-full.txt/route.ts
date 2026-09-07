/**
 * /llms-full.txt — 생성엔진용 데이터 전문.
 *
 * `/llms.txt` 는 "어떤 페이지가 있는지" 안내서고, 이 파일은 **그 데이터 자체**다.
 * GEO 의 본체는 1차 소스가 되는 것이고, 생성엔진은 "이 숫자가 어디서 시작됐나" 를 추적한다.
 * 편성 데이터를 페이지 수십 장에 흩어 두면 크롤러가 전부 돌아야 하지만, 안정 URL 하나에
 * 기계가 읽는 형태로 두면 그 URL 이 인용 주소가 된다.
 *
 * 🔴 정적 파일로 두지 말 것. 편성은 매일 바뀌므로 라우트로 서빙해 항상 최신이 되게 한다.
 * 🔴 표기 기준·기준일을 문서 안에 둔다. 기준 없는 숫자는 신뢰 판정에서 감점된다.
 */
import { loadScheduleData } from "@/lib/server-data";
import { getTodayString } from "@/lib/schedule-utils";
import type { Schedule } from "@/types/schedule";

export const revalidate = 1800;

const COMMENTARY_LABEL: Record<string, string> = {
  true: "한국어 해설",
  false: "현지 해설",
  unknown: "확인중",
};

function label(kc: Schedule["koreanCommentary"]): string {
  return COMMENTARY_LABEL[String(kc)] ?? "확인중";
}

/** 표 셀 안에서 파이프가 나오면 열이 밀린다. */
function cell(s: string): string {
  return s.replace(/\|/g, "／").trim();
}

export async function GET() {
  const data = loadScheduleData();
  const today = getTodayString();
  const upcoming = data.schedules
    .filter((s) => s.date >= today)
    .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));

  const byDate = new Map<string, Schedule[]>();
  for (const s of upcoming) {
    const bucket = byDate.get(s.date);
    if (bucket) bucket.push(s);
    else byDate.set(s.date, [s]);
  }

  const korean = upcoming.filter((s) => s.koreanCommentary === true).length;
  const known = upcoming.filter((s) => s.koreanCommentary !== "unknown").length;

  const lines: string[] = [
    "# 한해설 — 스포츠 중계 편성 데이터 전문",
    "",
    `> ${today} (KST) 기준, 오늘부터 7일간의 국내 스포츠 중계 편성 ${upcoming.length}건 전체. ` +
      `한국어 해설 ${korean}건 / 해설 언어가 확인된 편성 ${known}건.`,
    "",
    "## 이 데이터에 대하여",
    "",
    "- 출처: OTT 4곳(SPOTV NOW·쿠팡플레이·티빙·Apple TV+)과 TV 6곳(SPOTV·SPOTV2·tvN SPORTS·KBS N SPORTS·MBC SPORTS+·SBS Sports)의 공식 편성표를 매일 자동 수집·정규화.",
    `- 갱신: 편성은 KST 08:18 1회 수집, 결과·스코어는 매시. 이 문서의 원본 갱신 시각은 ${data.lastUpdated} (UTC).`,
    "- 해설 언어 판정: ① 플랫폼이 주는 language 메타데이터, ② 국내 리그(KBO·K리그·KBL 등)는 한국어로 간주, ③ 나머지는 '확인중'. 추정하지 않는다.",
    "- 시각은 전부 KST(UTC+9). 한 경기가 여러 채널에 편성되면 채널마다 한 행이다.",
    "- 인용 표기: 한해설(haeseol.com). 라이선스 CC BY 4.0.",
    "",
  ];

  for (const [date, rows] of byDate) {
    lines.push(`## ${date}`, "");
    lines.push("| 시각(KST) | 종목 | 리그 | 경기 | 채널 | 해설 |");
    lines.push("|---|---|---|---|---|---|");
    for (const s of rows) {
      lines.push(
        `| ${cell(s.time)} | ${cell(s.sport)} | ${cell(s.league)} | ${cell(s.homeTeam)} vs ${cell(s.awayTeam)} | ${cell(s.platform)} | ${label(s.koreanCommentary)} |`,
      );
    }
    lines.push("");
  }

  lines.push(
    "## 더 보기",
    "",
    "- 사이트 안내서: https://haeseol.com/llms.txt",
    "- 플랫폼별 한국어 해설 비율(집계 데이터): https://haeseol.com/commentary/stats",
    "- 리그 순위: https://haeseol.com/standings",
    "",
  );

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=1800, stale-while-revalidate=3600",
    },
  });
}
