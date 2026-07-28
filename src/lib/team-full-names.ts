/**
 * 순위표 축약 표기 → 정식 팀명.
 *
 * 네이버 순위표는 팀명을 축약해서 준다(`두산`, `시카고W`, `서울`). 팀 페이지(`/team/[slug]`)는
 * 그 값을 그대로 title·H1·keywords·description에 써왔다. 그런데 사람들이 실제로 검색하는 건
 * 정식명이다 — `두산 베어스 중계`, `시카고 화이트소스`, `FC서울 경기`. 축약명만 있으면 그
 * 쿼리로는 페이지가 매칭조차 되지 않는다. `시카고W`는 검색량이 0인 내부 표기다.
 *
 * 그래서 정식명을 앞세우고 축약명을 함께 노출한다(둘 다 실제 검색어라 양쪽을 잡아야 한다).
 *
 * **여기 없는 팀은 축약명을 그대로 쓴다.** 틀린 팀명이 title에 박히는 게 축약명보다 나쁘므로
 * 확인된 것만 채운다. MLS는 순위표가 이미 정식형(`밴쿠버 화이트캡스`)을 주므로 매핑이 없다.
 * 미매핑 리그는 `src/lib/team-full-names.test.ts`가 목록으로 남긴다.
 */

/** leagueSlug → (축약 표기 → 정식명) */
export const FULL_NAME_BY_LEAGUE: Record<string, Record<string, string>> = {
  kbo: {
    삼성: "삼성 라이온즈",
    KT: "KT 위즈",
    LG: "LG 트윈스",
    KIA: "KIA 타이거즈",
    두산: "두산 베어스",
    한화: "한화 이글스",
    NC: "NC 다이노스",
    롯데: "롯데 자이언츠",
    SSG: "SSG 랜더스",
    키움: "키움 히어로즈",
  },
  mlb: {
    애틀랜타: "애틀랜타 브레이브스",
    // 표기는 편성 데이터(schedule.json)를 따른다. 크롤러가 쓰는 이름과 팀 페이지 제목이
    // 어긋나면 같은 팀이 사이트 안에서 두 이름으로 존재하게 된다(엔티티 신호 훼손).
    시카고W: "시카고 화이트삭스",
    시카고컵스: "시카고 컵스",
    LA다저스: "LA 다저스",
    LA에인절스: "LA 에인절스",
    밀워키: "밀워키 브루어스",
    탬파베이: "탬파베이 레이스",
    텍사스: "텍사스 레인저스",
    애리조나: "애리조나 다이아몬드백스",
    클리블랜드: "클리블랜드 가디언스",
    휴스턴: "휴스턴 애스트로스",
    뉴욕양키스: "뉴욕 양키스",
    뉴욕메츠: "뉴욕 메츠",
    필라델피아: "필라델피아 필리스",
    시애틀: "시애틀 매리너스",
    보스턴: "보스턴 레드삭스",
    미네소타: "미네소타 트윈스",
    워싱턴: "워싱턴 내셔널스",
    피츠버그: "피츠버그 파이리츠",
    샌디에이고: "샌디에이고 파드리스",
    볼티모어: "볼티모어 오리올스",
    디트로이트: "디트로이트 타이거스",
    마이애미: "마이애미 말린스",
    샌프란시스코: "샌프란시스코 자이언츠",
    세인트루이스: "세인트루이스 카디널스",
    신시내티: "신시내티 레즈",
    콜로라도: "콜로라도 로키스",
    캔자스시티: "캔자스시티 로열스",
    토론토: "토론토 블루제이스",
    // 애슬레틱스는 2025 연고 이전으로 도시명이 붙지 않는다. 축약 = 정식이라 매핑 없음.
  },
  "k-league-1": {
    서울: "FC서울",
    전북: "전북 현대 모터스",
    강원: "강원FC",
    울산: "울산 HD",
    안양: "FC안양",
    인천: "인천 유나이티드",
    포항: "포항 스틸러스",
    제주: "제주 SK FC",
    대전: "대전 하나시티즌",
    김천: "김천 상무",
    부천: "부천FC 1995",
    광주: "광주FC",
  },
  "k-league-2": {
    부산: "부산 아이파크",
    수원: "수원 삼성 블루윙즈",
    서울E: "서울 이랜드FC",
    대구: "대구FC",
    김포: "김포FC",
    충남아산: "충남아산FC",
    경남: "경남FC",
    성남: "성남FC",
    천안: "천안시티FC",
    충북청주: "충북청주FC",
    안산: "안산 그리너스",
    전남: "전남 드래곤즈",
    // 수원FC·화성·용인·파주·김해는 순위표 표기가 이미 통용명이거나 정식명 확인이 필요해 비워둔다.
  },
};

/**
 * 정식명. 매핑이 없으면 축약명을 그대로 돌려준다.
 * 페이지 title·H1·description의 주 표기로 쓴다.
 */
export function fullTeamName(leagueSlug: string, shortName: string): string {
  return FULL_NAME_BY_LEAGUE[leagueSlug]?.[shortName] ?? shortName;
}

/** 정식명과 축약명이 다른지. 다를 때만 본문에 축약명을 병기한다. */
export function hasFullName(leagueSlug: string, shortName: string): boolean {
  return fullTeamName(leagueSlug, shortName) !== shortName;
}

/**
 * 검색어 후보 표기 전체(정식명 우선, 중복 제거).
 * keywords·JSON-LD alternateName에 넣어 양쪽 쿼리를 다 잡는다.
 */
export function teamNameVariants(leagueSlug: string, shortName: string): string[] {
  const full = fullTeamName(leagueSlug, shortName);
  return full === shortName ? [shortName] : [full, shortName];
}
