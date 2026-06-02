// 야구 이닝 표기: 소수 .1 = ⅓, .2 = ⅔ (아웃 카운트). "63.1"->"63⅓", "30.0"->"30".
export function formatInnings(inn: string): string {
  if (!inn) return "";
  const [whole, frac] = inn.split(".");
  const mark = frac === "1" ? "⅓" : frac === "2" ? "⅔" : "";
  return `${whole}${mark}`;
}
