import type { InsightContext } from "./build-context";

export function buildPrompt(ctx: InsightContext): string {
  const homeInfo = [
    ctx.homeTeam,
    ctx.homeRank ? `현재 ${ctx.homeRank}위` : null,
    ctx.homeRecentForm ? `최근 5경기 ${ctx.homeRecentForm}` : null,
    ctx.homeStreak,
  ]
    .filter(Boolean)
    .join(", ");

  const awayInfo = [
    ctx.awayTeam,
    ctx.awayRank ? `현재 ${ctx.awayRank}위` : null,
    ctx.awayRecentForm ? `최근 5경기 ${ctx.awayRecentForm}` : null,
    ctx.awayStreak,
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
- 참고: "최근 5경기"의 문자열은 왼쪽이 가장 최근 경기. 예) "LLWWW"는 가장 최근에 2연패, 그 이전에 3연승. "현재 N연승/연패"가 절대 기준이므로, 둘이 충돌하면 streak를 따른다.
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

[SEO 키워드 자연스럽게 노출]
다음 표현은 본문에 어색하지 않게 자연스럽게 1회 이상 녹여넣어줘 (억지 반복 금지):
- "${ctx.league}"
- "${ctx.homeTeam}" / "${ctx.awayTeam}"
- "${ctx.platform} 중계" 또는 "${ctx.platform}에서 시청"
- "한국어 해설"
예: "${ctx.league} ${ctx.homeTeam} vs ${ctx.awayTeam} 경기는 ${ctx.platform}에서 한국어 해설로 볼 수 있다"
`;
}
