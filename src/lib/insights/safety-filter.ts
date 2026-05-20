export const BETTING_TERMS = [
  "배당",
  "픽",
  "승률",
  "예측",
  "적중",
  "토토",
  "꽁머니",
  "베팅",
  "도박",
  "북메이커",
  "오즈",
  "환급률",
  "당첨",
  "단폴",
  "복합",
] as const;

const PATTERN = new RegExp(BETTING_TERMS.join("|"), "i");

export function containsBettingTerms(text: string): boolean {
  return PATTERN.test(text);
}
