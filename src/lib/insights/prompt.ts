import type { InsightContext } from "./build-context";
import type { Flow } from "./form-claim";

/**
 * 모델에게 "WWLDW" 같은 원문자열을 던지면 방향을 뒤집어 읽는다(실측).
 * 사람 말로 못 박아서 준다.
 */
function flowText(flow: Flow, streak?: string): string | null {
  const word =
    flow === "up"
      ? "상승 흐름(좋다)"
      : flow === "down"
        ? "하락 흐름(안 좋다)"
        : flow === "flat"
          ? "무승부로 끊긴 흐름"
          : null;
  if (!word) return null;
  return streak ? `${streak} = ${word}` : word;
}

export function buildPrompt(ctx: InsightContext): string {
  const homeInfo = [
    ctx.homeTeam,
    ctx.homeRank ? `현재 ${ctx.homeRank}위` : null,
    ctx.homeRecentForm ? `최근 5경기 ${ctx.homeRecentForm}(왼쪽이 최신)` : null,
    flowText(ctx.homeFlow, ctx.homeStreak),
  ]
    .filter(Boolean)
    .join(", ");

  const awayInfo = [
    ctx.awayTeam,
    ctx.awayRank ? `현재 ${ctx.awayRank}위` : null,
    ctx.awayRecentForm ? `최근 5경기 ${ctx.awayRecentForm}(왼쪽이 최신)` : null,
    flowText(ctx.awayFlow, ctx.awayStreak),
  ]
    .filter(Boolean)
    .join(", ");

  return `당신은 한국 스포츠 팬을 위한 관전 가이드 작성자입니다.
픽, 배당, 베팅, 승률, 예측에 대한 언급은 절대 하지 않습니다.
부상자나 라인업이 확실하지 않다면 그 부분은 생략합니다.

[경기 정보]
- 리그: ${ctx.league}
- 종목: ${ctx.sport}
- 홈팀: ${homeInfo}
- 원정팀: ${awayInfo}
- [흐름·절대 규칙] 각 팀 뒤에 "상승 흐름"/"하락 흐름"이라고 적어 뒀다. **그 반대 방향 표현을 쓰면 그 글은 폐기된다.**
  - 상승 흐름인 팀에 "연패·부진·주춤·반등이 필요·분위기 전환이 필요" 금지.
  - 하락 흐름인 팀에 "연승·상승세·좋은 흐름·직전 경기 승리" 금지.
  - 흐름 표시가 없는 팀은 흐름을 아예 언급하지 않는다.
${ctx.headToHead ? `- ${ctx.headToHead}` : ""}
- 한국 시간 킥오프: ${ctx.date} ${ctx.time} KST
- 한국어 해설 플랫폼: ${ctx.platform}

[출력 형식]
반드시 다음 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.

{
  "headline": "60자 이내, 경기의 핵심 매력 한 줄",
  "recentForm": "양 팀 최근 흐름. 100-150자",
  "keyMatchup": "주목할 선수 맞대결 또는 전술적 포인트. 150-200자",
  "watchPoints": ["관전 포인트 1", "관전 포인트 2", "관전 포인트 3"]
}

[작성 규칙]
- 전체 600-1000자
- **반드시 한국어로만 작성. 한자(漢字)·일본어(かな)·중국어 글자 절대 사용 금지.** 예: "稳定的"(X) → "안정적인"(O), "どう"(X) → "어떻게"(O), "戰"(X) → "전"(O)
- 외국 인명·팀명만 원어 표기 허용 (예: Lionel Messi, FC Barcelona). 일반 명사는 모두 한국어.
- 베팅/확률/예측/배당/픽/승률 단어 절대 금지
- "관전 포인트", "보는 재미", "주목할 부분" 중심
- 추측이 아닌 사실 위주
- [정확성·매우 중요] 연승/연패 횟수, 승-패 기록, 순위, 스코어 같은 **구체적 숫자는 본문에 절대 쓰지 않는다.** 이 수치들은 페이지에 별도 데이터로 정확히 표시되므로, 본문에서 숫자를 적으면 틀릴 위험만 생긴다. 팀 흐름은 위 [경기 정보]의 streak·최근 5경기 **방향에만 일치하게** 정성적으로 서술한다(연패 중이면 "부진"·"반등이 필요한 시점", 연승 중이면 "상승세"). 흐름 데이터가 주어지지 않았으면 흐름을 아예 언급하지 않는다.
- [경기 정보]에 주어지지 않은 사실(선수 부상, 이적, 특정 경기 결과·점수 등)은 절대 지어내지 않는다.

[SEO 키워드 자연스럽게 노출]
다음 표현은 본문에 어색하지 않게 자연스럽게 1회 이상 녹여넣어줘 (억지 반복 금지):
- "${ctx.league}"
- "${ctx.homeTeam}" / "${ctx.awayTeam}"
- "${ctx.platform} 중계" 또는 "${ctx.platform}에서 시청"
- "한국어 해설"
예: "${ctx.league} ${ctx.homeTeam} vs ${ctx.awayTeam} 경기는 ${ctx.platform}에서 한국어 해설로 볼 수 있다"
`;
}
