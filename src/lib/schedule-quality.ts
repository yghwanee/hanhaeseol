import type { Schedule } from "@/types/schedule";

/**
 * 편성 행의 파싱 신뢰도 판정.
 *
 * 2026-07-28 조사에서 나온 문제다. 특수 경기(KBO 올스타전, 실업배구 퓨처스 챔프전 등)는
 * 제목 포맷이 정규 경기와 달라서 크롤러별로 파싱이 어긋났고, 그 결과가 그대로 공개되고
 * 있었다. 실제 저장된 값:
 *
 *   league="2026"  home="드림"  away="KBO 올스타전 나눔"
 *   league="프로배구"  home="퓨처스 챔프전 단양대회 여자부 준결승 IBK기업은행"  away="현대건설"
 *   away="신한 SOL KBO 올스타 프라이데이 퓨처스 올스... 북부리그"   ← 원본 제목 자체가 잘려 있다
 *
 * 리그가 `2026`(연도)인 건 `normalizeLeague`가 아무 패턴도 못 맞혔다는 뜻이고, 팀명에
 * 이벤트명이 통째로 들어간 건 홈/원정 분리가 실패했다는 뜻이다.
 *
 * **크롤러 10종의 특수 제목 포맷을 전부 역공학하는 건 수렴하지 않는다**(제공처가 제목을
 * 잘라 보내는 경우까지 있다). 대신 **파싱이 실패한 행은 색인·사이트맵에서 빼는** 방향으로
 * 잡는다. 설명할 수 없는 페이지를 공개하지 않는 게 정직하고, 앞으로 생길 파싱 실패도
 * 자동으로 덮인다. 화면에는 계속 표시된다(편성 정보로서는 유효하다).
 */

/** 리그명이 연도만 남은 형태 = normalizeLeague 가 아무것도 못 맞혔다. */
function leagueLooksUnparsed(league: string): boolean {
  const t = league.trim();
  if (t === "") return true;
  return /^\d{2,4}(?:[-\s]\d{2,4})?$/.test(t);
}

/**
 * 팀명이 아니라 대회·이벤트 문구가 들어온 것으로 보이는지.
 *
 * 정상인데 이 단어를 포함하는 팀명이 실제로 있어서(올스타전 팀은 이름 자체가 `나눔 올스타`,
 * `아메리칸리그`, `남부리그`다) 단어 포함만으로는 못 자른다. **길이와 토큰 수를 함께 본다** —
 * 대회명이 붙으면 팀명이 길어진다.
 */
const EVENT_MARKERS =
  /(올스타|퓨처스\s*챔프전|챔피언결정|플레이오프|준결승|결승|조별|예선|\d+강전?|대회|연맹|배구연맹)/;

/** 스폰서·주최 표기가 팀명에 들어온 흔적. 이건 정상 팀명에 나올 수 없다. */
const SPONSOR_MARKERS = /(신한\s*SOL|프라이데이|한국실업)/;

export function teamNameLooksUnparsed(name: string): boolean {
  const t = name.trim();
  if (t === "") return true;
  // 제공처가 제목을 잘라 보낸 흔적. 팀명에 생략부호가 있을 수 없다.
  if (/(\.{3}|…)/.test(t)) return true;
  if (SPONSOR_MARKERS.test(t)) return true;
  // 대회 문구 + 긴 이름 = 대회명이 앞에 붙은 것.
  // `나눔 올스타`(6자)·`아메리칸리그`(6자)·`MLS 올스타`(8자) 같은 정상 팀명은 짧다.
  if (EVENT_MARKERS.test(t) && t.length >= 13) return true;
  // 대회 문구 없이도 비정상적으로 긴 것은 토큰 수로 본다.
  // `슈가랜드 스페이스 카우보이스`(3토큰)는 통과, 5토큰 이상은 팀명이 아니다.
  if (t.split(/\s+/).length >= 5) return true;
  return false;
}

/**
 * 이 편성 행을 검색엔진에 공개해도 되는 수준으로 파싱됐는지.
 * `isRichMatch`(사이트맵 + 매치 페이지 noindex 공용)에서 함께 쓴다.
 */
export function isReliablyParsed(match: Schedule): boolean {
  if (leagueLooksUnparsed(match.league ?? "")) return false;
  if (teamNameLooksUnparsed(match.homeTeam ?? "")) return false;
  if (teamNameLooksUnparsed(match.awayTeam ?? "")) return false;
  return true;
}
