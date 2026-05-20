import type { InsightContext } from "./build-context";

export function buildPrompt(ctx: InsightContext): string {
  const homeInfo = [
    ctx.homeTeam,
    ctx.homeRank ? `현재 ${ctx.homeRank}위` : null,
    ctx.homeRecentForm ? `최근 5경기 ${ctx.homeRecentForm}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  const awayInfo = [
    ctx.awayTeam,
    ctx.awayRank ? `현재 ${ctx.awayRank}위` : null,
    ctx.awayRecentForm ? `최근 5경기 ${ctx.awayRecentForm}` : null,
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
${ctx.headToHead ? `- ${ctx.headToHead}` : ""}
- 한국 시간 킥오프: ${ctx.date} ${ctx.time} KST
- 한국어 해설 플랫폼: ${ctx.platform}

[출력 형식]
반드시 다음 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요.

{
  "headline": "60자 이내, 경기의 핵심 매력 한 줄",
  "recentForm": "양 팀 최근 흐름. 100-150자",
  "keyMatchup": "주목할 선수 맞대결 또는 전술적 포인트. 150-200자",
  "watchPoints": ["관전 포인트 1", "관전 포인트 2", "관전 포인트 3"],
  "viewingInfo": "한국어 해설 시청 안내. ${ctx.platform}에서 ${ctx.time}부터 시청 가능 안내 포함. 50-100자"
}

[작성 규칙]
- 전체 600-1000자
- 베팅/확률/예측/배당/픽/승률 단어 절대 금지
- "관전 포인트", "보는 재미", "주목할 부분" 중심
- 추측이 아닌 사실 위주
`;
}
