/**
 * 코리안리거 로스터 수집 대상.
 *
 * 🔴 이 파일에 "선수 → 팀"을 적지 않는다. 팀은 이적으로 바뀌고, 손으로 적은 값은
 * 반드시 낡는다(2026-08-23: 이강인이 7월에 AT 마드리드로 갔는데 코드가 한 달 넘게
 * PSG 로 알고 있었고, 그 탓에 히어로 선정이 엉뚱한 경기를 골랐다).
 * 팀은 매일 크롤로 채운다. 여기 적는 건 "어디를 훑을지"와 "이름 표기"뿐이다.
 */

/** 네이버 categoryId → schedule.json 리그명. 해외 리그만 — 국내 리그는 전원 한국인이라 의미 없다. */
export const SOCCER_SOURCES: Array<{ categoryId: string; league: string }> = [
  { categoryId: "epl", league: "프리미어리그" },
  { categoryId: "primera", league: "라리가" },
  { categoryId: "bundesliga", league: "분데스리가" },
  { categoryId: "seria", league: "세리에A" },
  { categoryId: "ligue1", league: "리그 1" },
  { categoryId: "eredivisie", league: "에레디비시" },
  // EFL 챔피언십 = 네이버 categoryId "england2"("championship"·"efl" 은 빈 시즌만 온다).
  { categoryId: "england2", league: "EFL 챔피언십" },
  { categoryId: "mls", league: "MLS" },
  { categoryId: "champs", league: "챔피언스리그" },
  { categoryId: "europa", league: "유로파리그" },
];

/** 네이버 countryName 이 이 값이면 한국 선수로 본다. */
export const KR_COUNTRY_NAMES = new Set(["대한민국", "한국"]);

/**
 * MLB 는 네이버에 선수 목록 API 가 없어 MLB 공식 StatsAPI(무료·키 불필요)를 쓴다.
 * 영문 이름 → 한국어 표기. **이름은 이적해도 안 바뀌므로** 손으로 적어도 낡지 않는다.
 *
 * 이 표는 허용 목록도 겸한다. `birthCountry` 만 보면 한국에서 태어난 미국 선수
 * (예: Rob Refsnyder)까지 코리안리거로 잡힌다.
 */
export const MLB_KOREAN_NAMES: Record<string, string> = {
  "Ha-Seong Kim": "김하성",
  "Jung Hoo Lee": "이정후",
  "Hyeseong Kim": "김혜성",
  "Jihwan Bae": "배지환",
  "Woo-Suk Go": "고우석",
  "Sung-Mun Song": "송성문",
  "Hyun Jin Ryu": "류현진",
  "Ji Man Choi": "최지만",
};

/** MLB StatsAPI 팀 id → schedule.json 팀명. 팀은 안 바뀌므로 고정표로 둔다. */
export const MLB_TEAM_ID_TO_SCHEDULE: Record<number, string> = {
  108: "LA 에인절스",
  109: "애리조나 다이아몬드백스",
  110: "볼티모어 오리올스",
  111: "보스턴 레드삭스",
  112: "시카고 컵스",
  113: "신시내티 레즈",
  114: "클리블랜드 가디언스",
  115: "콜로라도 로키스",
  116: "디트로이트 타이거스",
  117: "휴스턴 애스트로스",
  118: "캔자스시티 로열스",
  119: "LA 다저스",
  120: "워싱턴 내셔널스",
  121: "뉴욕 메츠",
  133: "애슬레틱스",
  134: "피츠버그 파이리츠",
  135: "샌디에이고 파드리스",
  136: "시애틀 매리너스",
  137: "샌프란시스코 자이언츠",
  138: "세인트루이스 카디널스",
  139: "탬파베이 레이스",
  140: "텍사스 레인저스",
  141: "토론토 블루제이스",
  142: "미네소타 트윈스",
  143: "필라델피아 필리스",
  144: "애틀랜타 브레이브스",
  145: "시카고 화이트삭스",
  146: "마이애미 말린스",
  147: "뉴욕 양키스",
  158: "밀워키 브루어스",
};
