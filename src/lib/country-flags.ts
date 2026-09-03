// 월드컵 국가대표팀은 네이버 앰블럼이 generic placeholder(.../wfootball/default/...)라
// 카드/순위표에서 사실상 빈 칸으로 보인다. 팀명이 국가명이므로 앰블럼 대신 국기를 쓴다.
//
// 출처: flagcdn.com (ISO 3166-1 alpha-2 코드 기반). CORS·핫링크 제한이 없어
// pstatic 앰블럼과 달리 same-origin 프록시(/api/emblem)가 필요 없다.
// 잉글랜드/스코틀랜드는 영국 하위 행정구역 코드(gb-eng, gb-sct)를 지원한다.

const ISO_CODE: Record<string, string> = {
  가나: "gh",
  "남아프리카 공화국": "za",
  네덜란드: "nl",
  노르웨이: "no",
  뉴질랜드: "nz",
  나이지리아: "ng",
  대한민국: "kr",
  독일: "de",
  멕시코: "mx",
  모로코: "ma",
  미국: "us",
  벨기에: "be",
  "보스니아 헤르체고비나": "ba",
  브라질: "br",
  사우디아라비아: "sa",
  세네갈: "sn",
  스웨덴: "se",
  스위스: "ch",
  스코틀랜드: "gb-sct",
  스페인: "es",
  아르헨티나: "ar",
  아이티: "ht",
  알제리: "dz",
  에콰도르: "ec",
  오스트리아: "at",
  요르단: "jo",
  우루과이: "uy",
  우즈베키스탄: "uz",
  이라크: "iq",
  이란: "ir",
  이집트: "eg",
  일본: "jp",
  헝가리: "hu",
  잉글랜드: "gb-eng",
  체코: "cz",
  카보베르데: "cv",
  "카보베르데 제도": "cv", // 순위표 표기
  카타르: "qa",
  캐나다: "ca",
  코트디부아르: "ci",
  콜롬비아: "co",
  콩고민주공화국: "cd",
  퀴라소: "cw",
  크로아티아: "hr",
  튀니지: "tn",
  튀르키예: "tr",
  파나마: "pa",
  파라과이: "py",
  포르투갈: "pt",
  프랑스: "fr",
  호주: "au",
  // "미정"(조 미정 TBD)은 의도적으로 제외 → 국기 없이 팀명만 노출
};

/** 국가대표팀명 → 국기 이미지 URL. 매칭되는 국가가 없으면 null(클럽·KBO 등은 자연히 미스). */
export function flagUrl(teamName: string): string | null {
  const code = ISO_CODE[teamName];
  return code ? `https://flagcdn.com/w160/${code}.png` : null;
}
