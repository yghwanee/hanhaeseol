/**
 * 한국어 조사 선택.
 *
 * 템플릿에 이름을 꽂을 때 조사를 고정해두면 "아스날는 시즌 0승", "선두 서울와 승점 8 차"처럼
 * 틀린 문장이 페이지 수백 개에 그대로 박힌다. 실제로 매치 페이지와 팀 페이지 양쪽에서 나왔다.
 *
 * 받침 유무로 고른다. 한글이 아닌 글자로 끝나면(영문·숫자) 소리로 판단할 수 없으므로
 * 받침 없는 쪽을 쓴다. "KT와", "LG는"이 자연스럽다.
 */

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

/** 숫자를 읽었을 때 받침으로 끝나는지. 1(일), 7(칠), 8(팔), 0(영)은 받침이 있다. */
const DIGIT_HAS_FINAL: Record<string, boolean> = {
  "0": true,
  "1": true,
  "2": false,
  "3": true,
  "4": false,
  "5": false,
  "6": true,
  "7": true,
  "8": true,
  "9": false,
};

export function hasFinalConsonant(word: string): boolean {
  const last = word.trim().slice(-1);
  if (last === "") return false;

  const code = last.charCodeAt(0);
  if (code >= HANGUL_START && code <= HANGUL_END) {
    return (code - HANGUL_START) % 28 !== 0;
  }
  if (last in DIGIT_HAS_FINAL) return DIGIT_HAS_FINAL[last];

  // 영문 등 판단 불가한 글자는 받침 없는 쪽으로 붙인다.
  return false;
}

/**
 * 단어에 맞는 조사를 돌려준다.
 *   josa("서울", "와/과") → "과"
 *   josa("강원", "이/가") → "이"
 */
export function josa(word: string, pair: string): string {
  const [withFinal, withoutFinal] = pair.split("/");
  // "와/과"처럼 앞이 받침 없는 쪽인 짝과, "은/는"처럼 앞이 받침 있는 쪽인 짝이 섞여 있다.
  // 표기 순서를 그대로 믿지 않고 잘 알려진 짝을 명시한다.
  const FINAL_FIRST = new Set(["은/는", "이/가", "을/를", "으로/로", "과/와"]);
  const has = hasFinalConsonant(word);
  if (FINAL_FIRST.has(pair)) return has ? withFinal : withoutFinal;
  return has ? withoutFinal : withFinal;
}

/** 단어 뒤에 조사를 붙인 문자열. `withJosa("서울", "와/과")` → "서울과" */
export function withJosa(word: string, pair: string): string {
  return `${word}${josa(word, pair)}`;
}
