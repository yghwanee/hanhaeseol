// src/lib/tiktok-caption.ts
//
// 틱톡 전용 캡션 빌더 — IG 캡션(buildCaption) 재사용을 중단한 이유(2026-07-19):
// @hanhaeseol 이 몇 주째 조회수 0 = 틱톡 "비독창적/저품질 콘텐츠 → FYP 추천 부적격"
// 분류가 유력한데, IG 캡션 재사용분에 스팸 신호 3종이 그대로 실려 있었다.
//   ① 캡션 내 생 URL(haeseol.com/tt) — 틱톡에선 클릭도 안 되고 홍보성 신호만 줌
//   ② 해시태그 13개(#fyp #추천 등 범용 태그 도배) — 태그 스터핑
//   ③ 매일 똑같은 템플릿 문장 — 대량생산 콘텐츠 신호
// 여기서는: URL 금지, 태그는 매치 기반 5개(매일 달라짐)만, 첫 줄은 후킹 템플릿을
// 날짜 기반으로 순환시켜 문장 박제를 피한다.

import { getHeroMatchLines, getHierarchicalTags } from "./hashtags";
import { inferDayLabel, loadKoreanMatchesAll } from "./instagram";
import { pickHeroMatch } from "./hero-pick";

/** "04:00" → "새벽 4시", "18:30" → "저녁 6시 30분" — 말맛 있는 시간 표기 */
export function speakTime(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]);
  const min = Number(m[2]);
  const slot = h < 6 ? "새벽" : h < 11 ? "아침" : h < 13 ? "낮" : h < 18 ? "오후" : h < 21 ? "저녁" : "밤";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return min === 0 ? `${slot} ${h12}시` : `${slot} ${h12}시 ${min}분`;
}

interface HookCtx {
  matchup: string;   // "스페인 vs 아르헨티나"
  time: string;      // "새벽 4시"
  platform: string;  // "JTBC"
  day: "오늘" | "내일";
}

// 첫 줄 = 첫 프레임 텍스트처럼 읽히는 후킹 (viral-hooks: 페이오프를 다 풀지 말고
// 다음 줄을 읽게 만든다. 소리 꺼진 상태 가정, 서두 없이 핵심어 선두 배치).
// 날짜(일)로 결정적 순환 — 매일 같은 문장 반복을 피하면서 재현 가능.
const HOOKS: Array<(c: HookCtx) => string> = [
  (c) => `${c.matchup}, ${c.day} ${c.time}. 어디서 보는지 모르면 일단 저장.`,
  (c) => `${c.day} ${c.time} ${c.matchup}, 한국어 해설은 ${c.platform}에서.`,
  (c) => `${c.matchup} 알람 맞춘 사람만 보세요.`,
  (c) => `${c.day} 놓치면 안 되는 경기 1순위: ${c.matchup}`,
  (c) => `${c.matchup} 몇 시에 어디서? 3초면 답 나옵니다.`,
];

/**
 * @param today  KST YYYY-MM-DD (KST_OFFSET_DAYS 반영된 대상 날짜)
 */
export function buildTiktokCaption(today: string): string {
  const day = inferDayLabel(today);
  const games = loadKoreanMatchesAll(today);
  const { lines, totalGames } = getHeroMatchLines(today, 3);
  const tags = getHierarchicalTags(today).tags;

  const body: string[] = [];

  const hero = games.length ? pickHeroMatch(games) : null;
  const heroHome = hero && hero.homeTeam !== "미정" ? hero.homeTeam : null;
  const heroAway = hero && hero.awayTeam && hero.awayTeam !== "미정" ? hero.awayTeam : null;
  if (hero && heroHome) {
    const ctx: HookCtx = {
      matchup: heroAway ? `${heroHome} vs ${heroAway}` : heroHome,
      time: speakTime(hero.time),
      platform: hero.platform,
      day,
    };
    const idx = Number(today.slice(8, 10)) % HOOKS.length;
    body.push(HOOKS[idx](ctx));
  } else {
    body.push(`${day}의 한국어 해설 경기, 한 번에 정리했습니다.`);
  }

  if (lines.length > 0) {
    body.push("");
    for (const line of lines) body.push(line);
    if (totalGames > lines.length) body.push(`+ ${totalGames - lines.length}경기 더`);
  } else {
    body.push("");
    body.push(`${day}은 한국어 해설 편성이 없어요. 대신 볼만한 경기 정리.`);
  }

  body.push("");
  body.push(`전체 편성표는 '한해설' 검색 🔍`);
  body.push("");
  body.push(tags.join(" "));

  return body.join("\n");
}
