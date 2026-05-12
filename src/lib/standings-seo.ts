/**
 * 순위 페이지(/standings/[slug])용 리그별 SEO 메타.
 * - slug: URL 슬러그 (/league/[slug]와 동일하게 통일하여 내부링크 일관성 유지)
 * - dataId: standings.json 내 league.id
 * - scheduleSlug: 편성표 페이지로 연결할 슬러그 (없으면 메인 ?sport= 로)
 */
export type StandingsSeoMeta = {
  slug: string;
  dataId: string;
  sport: "soccer" | "baseball";
  display: string;
  short: string;
  seasonLabel: string;
  title: string;
  description: string;
  keywords: string[];
  intro: string;
  scheduleSlug?: string;
};

export const STANDINGS_LEAGUES: StandingsSeoMeta[] = [
  {
    slug: "epl",
    dataId: "epl",
    sport: "soccer",
    display: "프리미어리그 (EPL)",
    short: "EPL",
    seasonLabel: "2025-26",
    scheduleSlug: "epl",
    title: "EPL 순위 - 프리미어리그 팀 순위표 2025-26 | 한해설",
    description:
      "2025-26 잉글랜드 프리미어리그(EPL) 팀 순위. 승점·득실차·연속 결과·UCL/UEL 진출권을 한눈에. 한국어 해설 중계 편성표와 함께 확인하세요.",
    keywords: [
      "EPL 순위",
      "프리미어리그 순위",
      "EPL 팀 순위",
      "잉글랜드 프리미어리그 순위표",
      "EPL 승점",
      "프리미어리그 순위표 2025-26",
      "맨시티 순위",
      "리버풀 순위",
      "아스날 순위",
    ],
    intro:
      "잉글랜드 프리미어리그(EPL) 2025-26 시즌 팀 순위입니다. 승점·득실차·최근 5경기 결과·연속 성적을 한눈에 확인하고, 챔피언스리그·유로파리그 진출권과 강등권을 색상으로 구분해 보여줍니다.",
  },
  {
    slug: "laliga",
    dataId: "primera",
    sport: "soccer",
    display: "라리가",
    short: "라리가",
    seasonLabel: "2025-26",
    scheduleSlug: "laliga",
    title: "라리가 순위 - 스페인 프리메라리가 팀 순위표 2025-26 | 한해설",
    description:
      "2025-26 라리가(스페인 프리메라) 팀 순위. 레알 마드리드·바르셀로나·아틀레티코 등 승점·득실·연속 결과를 한눈에. 한국어 해설 중계 일정과 함께.",
    keywords: [
      "라리가 순위",
      "프리메라리가 순위",
      "스페인 리그 순위",
      "라리가 순위표",
      "레알 마드리드 순위",
      "바르셀로나 순위",
      "라리가 승점",
    ],
    intro:
      "라리가(스페인 프리메라리가) 2025-26 시즌 팀 순위입니다. 레알 마드리드와 바르셀로나의 엘 클라시코 경쟁, 아틀레티코 마드리드의 추격을 한눈에 확인하세요.",
  },
  {
    slug: "bundesliga",
    dataId: "bundesliga",
    sport: "soccer",
    display: "분데스리가",
    short: "분데스",
    seasonLabel: "2025-26",
    scheduleSlug: "bundesliga",
    title: "분데스리가 순위 - 독일 1부 팀 순위표 2025-26 | 한해설",
    description:
      "2025-26 분데스리가 팀 순위. 바이에른 뮌헨(김민재)·도르트문트 등 승점·득실·연속 결과를 한눈에. 한국어 해설 중계 일정과 함께.",
    keywords: [
      "분데스리가 순위",
      "독일 분데스리가 순위",
      "분데스리가 순위표",
      "바이에른 뮌헨 순위",
      "도르트문트 순위",
      "김민재 분데스리가",
    ],
    intro:
      "분데스리가(독일 1부) 2025-26 시즌 팀 순위입니다. 김민재가 활약하는 바이에른 뮌헨의 행보를 한눈에 확인하세요.",
  },
  {
    slug: "seriea",
    dataId: "seria",
    sport: "soccer",
    display: "세리에 A",
    short: "세리에",
    seasonLabel: "2025-26",
    scheduleSlug: "seriea",
    title: "세리에A 순위 - 이탈리아 1부 팀 순위표 2025-26 | 한해설",
    description:
      "2025-26 세리에A 팀 순위. 유벤투스·AC 밀란·인터·나폴리 등 승점·득실·연속 결과를 한눈에. 한국어 해설 중계 일정과 함께.",
    keywords: [
      "세리에A 순위",
      "이탈리아 세리에A 순위",
      "세리에A 순위표",
      "유벤투스 순위",
      "AC 밀란 순위",
      "인터 밀란 순위",
      "나폴리 순위",
    ],
    intro:
      "세리에A(이탈리아 1부) 2025-26 시즌 팀 순위입니다. 유벤투스·AC 밀란·인터·나폴리의 스쿠데토 경쟁을 한눈에.",
  },
  {
    slug: "ligue1",
    dataId: "ligue1",
    sport: "soccer",
    display: "리그 1",
    short: "리그앙",
    seasonLabel: "2025-26",
    scheduleSlug: "ligue1",
    title: "리그앙 순위 - 프랑스 1부(리그 1) 팀 순위표 2025-26 | 한해설",
    description:
      "2025-26 프랑스 리그 1(리그앙) 팀 순위. PSG(이강인)·마르세유·모나코 등 승점·득실·연속 결과를 한눈에.",
    keywords: [
      "리그앙 순위",
      "리그1 순위",
      "프랑스 리그앙 순위",
      "PSG 순위",
      "파리 생제르맹 순위",
      "이강인 리그앙",
    ],
    intro:
      "프랑스 리그 1(리그앙) 2025-26 시즌 팀 순위입니다. 이강인이 활약하는 PSG의 리그 우승 행보를 한눈에.",
  },
  {
    slug: "champions-league",
    dataId: "champs",
    sport: "soccer",
    display: "UEFA 챔피언스리그",
    short: "챔스",
    seasonLabel: "2025-26",
    scheduleSlug: "champions-league",
    title: "챔피언스리그 순위 - UCL 리그페이즈 순위표 2025-26 | 한해설",
    description:
      "2025-26 UEFA 챔피언스리그(UCL) 리그페이즈 팀 순위. 36개 팀 승점·득실·진출권 순위를 한눈에. 한국어 해설 중계 일정과 함께.",
    keywords: [
      "챔피언스리그 순위",
      "UCL 순위",
      "챔스 순위",
      "챔피언스리그 리그페이즈",
      "UCL 순위표 2025-26",
    ],
    intro:
      "UEFA 챔피언스리그 2025-26 시즌 리그페이즈 팀 순위입니다. 36개 팀의 승점과 16강 진출권을 한눈에.",
  },
  {
    slug: "europa-league",
    dataId: "europa",
    sport: "soccer",
    display: "UEFA 유로파리그",
    short: "유로파",
    seasonLabel: "2025-26",
    scheduleSlug: "europa-league",
    title: "유로파리그 순위 - UEL 리그페이즈 순위표 2025-26 | 한해설",
    description:
      "2025-26 UEFA 유로파리그(UEL) 리그페이즈 팀 순위. 36개 팀 승점·득실·진출권 순위를 한눈에. 한국어 해설 중계 일정과 함께.",
    keywords: [
      "유로파리그 순위",
      "UEL 순위",
      "유로파리그 순위표",
      "유로파리그 리그페이즈",
    ],
    intro:
      "UEFA 유로파리그 2025-26 시즌 리그페이즈 팀 순위입니다. 36개 팀의 16강 진출권을 한눈에.",
  },
  {
    slug: "mls",
    dataId: "mls",
    sport: "soccer",
    display: "MLS",
    short: "MLS",
    seasonLabel: "2026",
    scheduleSlug: "mls",
    title: "MLS 순위 - 메이저 리그 사커 팀 순위표 2026 | 한해설",
    description:
      "2026 MLS(메이저 리그 사커) 팀 순위. 메시가 뛰는 인터 마이애미·LA 갤럭시·로스앤젤레스 등 승점·득실을 한눈에.",
    keywords: [
      "MLS 순위",
      "메이저 리그 사커 순위",
      "MLS 순위표",
      "인터 마이애미 순위",
      "메시 MLS",
    ],
    intro:
      "MLS(메이저 리그 사커) 2026 시즌 팀 순위입니다. 메시가 뛰는 인터 마이애미의 행보를 한눈에.",
  },
  {
    slug: "k-league-1",
    dataId: "kleague",
    sport: "soccer",
    display: "K리그1",
    short: "K리그",
    seasonLabel: "2026",
    scheduleSlug: "k-league-1",
    title: "K리그1 순위 - 한국 프로축구 1부 팀 순위표 2026 | 한해설",
    description:
      "2026 K리그1(한국 프로축구 1부) 팀 순위. 울산·전북·포항·서울 등 승점·득실·연속 결과를 한눈에.",
    keywords: [
      "K리그1 순위",
      "K리그 순위",
      "한국 프로축구 순위",
      "K리그1 순위표",
      "K리그 승점",
    ],
    intro:
      "K리그1(한국 프로축구 1부) 2026 시즌 팀 순위입니다. 모든 K리그 경기의 한국어 중계 편성과 함께 확인하세요.",
  },
  {
    slug: "k-league-2",
    dataId: "kleague2",
    sport: "soccer",
    display: "K리그2",
    short: "K리그2",
    seasonLabel: "2026",
    scheduleSlug: "k-league-2",
    title: "K리그2 순위 - 한국 프로축구 2부 팀 순위표 2026 | 한해설",
    description:
      "2026 K리그2(한국 프로축구 2부) 팀 순위. 승강 플레이오프 진출권까지 한눈에. 한국어 중계 편성과 함께.",
    keywords: [
      "K리그2 순위",
      "K리그2 순위표",
      "한국 프로축구 2부 순위",
      "K리그 챌린지 순위",
    ],
    intro:
      "K리그2(한국 프로축구 2부) 2026 시즌 팀 순위입니다. 승강 플레이오프 진출권을 한눈에.",
  },
  {
    slug: "eredivisie",
    dataId: "eredivisie",
    sport: "soccer",
    display: "에레디비시",
    short: "에레디",
    seasonLabel: "2025-26",
    title: "에레디비시 순위 - 네덜란드 1부 팀 순위표 2025-26 | 한해설",
    description:
      "2025-26 에레디비시(네덜란드 1부) 팀 순위. PSV·아약스·페예노르트 등 승점·득실·연속 결과를 한눈에.",
    keywords: [
      "에레디비시 순위",
      "네덜란드 에레디비시 순위",
      "에레디비시 순위표",
      "아약스 순위",
      "PSV 순위",
    ],
    intro:
      "에레디비시(네덜란드 1부) 2025-26 시즌 팀 순위입니다. 아약스·PSV·페예노르트의 전통 강호 경쟁을 한눈에.",
  },
  {
    slug: "kbo",
    dataId: "kbo",
    sport: "baseball",
    display: "KBO 리그",
    short: "KBO",
    seasonLabel: "2026",
    scheduleSlug: "kbo",
    title: "KBO 순위 - 한국 프로야구 팀 순위표 2026 | 한해설",
    description:
      "2026 KBO 리그(한국 프로야구) 팀 순위. 승률·게임차·연속 결과를 한눈에. 한국어 해설 중계 편성표와 함께.",
    keywords: [
      "KBO 순위",
      "KBO 리그 순위",
      "프로야구 순위",
      "KBO 팀 순위",
      "KBO 승률",
      "프로야구 순위표",
      "KBO 게임차",
    ],
    intro:
      "KBO 리그(한국 프로야구) 2026 시즌 팀 순위입니다. 두산·LG·KIA·삼성 등 KBO 10개 구단의 승률과 게임차를 한눈에.",
  },
  {
    slug: "mlb",
    dataId: "mlb",
    sport: "baseball",
    display: "MLB (메이저리그)",
    short: "MLB",
    seasonLabel: "2026",
    scheduleSlug: "mlb",
    title: "MLB 순위 - 아메리칸·내셔널리그 지구별 순위표 2026 | 한해설",
    description:
      "2026 MLB(메이저리그) 지구별 팀 순위. 아메리칸리그(동·중·서부) · 내셔널리그(동·중·서부) 각 지구 순위, 다저스·양키스 등 한국 선수 소속팀까지 승률·게임차를 한눈에.",
    keywords: [
      "MLB 순위",
      "메이저리그 순위",
      "MLB 지구 순위",
      "아메리칸리그 순위",
      "내셔널리그 순위",
      "AL 동부 순위",
      "AL 중부 순위",
      "AL 서부 순위",
      "NL 동부 순위",
      "NL 중부 순위",
      "NL 서부 순위",
      "MLB 팀 순위",
      "MLB 순위표",
      "다저스 순위",
      "양키스 순위",
      "MLB 승률",
    ],
    intro:
      "MLB(메이저리그) 2026 시즌 지구별 팀 순위입니다. 아메리칸리그(동부·중부·서부)와 내셔널리그(동부·중부·서부) 각 지구를 네이버 스포츠와 동일한 구조로 분리해 보여줍니다.",
  },
];

export function findStandingsBySlug(slug: string): StandingsSeoMeta | undefined {
  return STANDINGS_LEAGUES.find((l) => l.slug === slug);
}

export function findStandingsByDataId(id: string): StandingsSeoMeta | undefined {
  return STANDINGS_LEAGUES.find((l) => l.dataId === id);
}
