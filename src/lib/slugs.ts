export type SeoMeta = {
  slug: string;
  /** schedule.json의 league / platform 값과 정확히 일치해야 한다 */
  match: string[];
  display: string;
  sport?: string;
  title: string;
  description: string;
  keywords: string[];
  intro: string;
};

export const LEAGUE_SEO: SeoMeta[] = [
  {
    slug: "epl",
    match: ["프리미어리그"],
    display: "프리미어리그 (EPL)",
    sport: "축구",
    title: "EPL 중계 편성표 | 프리미어리그 한국어 해설 일정 - 한해설",
    description:
      "프리미어리그(EPL) 중계 편성표. 맨체스터 유나이티드, 리버풀, 첼시, 아스널 등 주요 경기의 한국어 해설 중계 일정을 확인하세요.",
    keywords: ["EPL 중계", "EPL 한국어중계", "프리미어리그 중계", "프리미어리그 한국어중계", "EPL 편성표", "프리미어리그 편성표", "해외축구 중계"],
    intro:
      "프리미어리그(EPL) 한국어 해설 중계 편성표입니다. 쿠팡플레이, SPOTV NOW 등 국내 모든 중계 플랫폼의 EPL 편성 일정을 한눈에 확인하세요.",
  },
  {
    slug: "laliga",
    match: ["라리가"],
    display: "라리가",
    sport: "축구",
    title: "라리가 중계 편성표 | 레알 마드리드·바르셀로나 한국어 해설 - 한해설",
    description:
      "라리가 중계 편성표. 레알 마드리드, 바르셀로나, 아틀레티코 마드리드 경기의 한국어 해설 중계 일정을 확인하세요.",
    keywords: ["라리가 중계", "라리가 한국어중계", "레알 마드리드 중계", "바르셀로나 중계", "라리가 편성표", "스페인 리그 중계"],
    intro:
      "라리가 한국어 해설 중계 편성표입니다. 엘 클라시코(레알 마드리드 vs 바르셀로나) 등 주요 경기의 한국어 해설 일정을 확인하세요.",
  },
  {
    slug: "bundesliga",
    match: ["분데스리가"],
    display: "분데스리가",
    sport: "축구",
    title: "분데스리가 중계 편성표 | 바이에른 뮌헨 한국어 해설 - 한해설",
    description:
      "분데스리가 중계 편성표. 바이에른 뮌헨, 도르트문트 등 독일 분데스리가 한국어 해설 중계 일정.",
    keywords: ["분데스리가 중계", "분데스리가 한국어중계", "바이에른 뮌헨 중계", "김민재 중계", "분데스리가 편성표", "독일 축구 중계"],
    intro:
      "분데스리가 한국어 해설 중계 편성표입니다. 바이에른 뮌헨, 도르트문트 등 주요 경기 일정을 한눈에.",
  },
  {
    slug: "seriea",
    match: ["세리에A"],
    display: "세리에 A",
    sport: "축구",
    title: "세리에A 중계 편성표 | 이탈리아 1부 한국어 해설 - 한해설",
    description:
      "세리에A 중계 편성표. 유벤투스, AC 밀란, 인터 밀란, 나폴리 등 이탈리아 1부 한국어 해설 일정.",
    keywords: ["세리에A 중계", "세리에A 한국어중계", "유벤투스 중계", "AC 밀란 중계", "세리에A 편성표", "이탈리아 리그"],
    intro:
      "세리에A 한국어 해설 중계 편성표입니다. 유벤투스, AC 밀란, 인터 밀란 등 이탈리아 1부 리그 경기 일정.",
  },
  {
    slug: "ligue1",
    match: ["리그 1", "리그1"],
    display: "리그 1",
    sport: "축구",
    title: "리그 1 중계 편성표 | 파리 생제르맹 한국어 해설 - 한해설",
    description:
      "프랑스 리그 1 중계 편성표. PSG(파리 생제르맹), 마르세유, 모나코 등 한국어 해설 일정.",
    keywords: ["리그1 중계", "PSG 중계", "파리 생제르맹 중계", "리그1 편성표", "프랑스 축구", "이강인 중계"],
    intro:
      "프랑스 리그 1 한국어 해설 중계 편성표입니다. PSG(파리 생제르맹), 마르세유 등 주요 경기 일정.",
  },
  {
    slug: "champions-league",
    match: ["챔피언스리그", "UEFA 챔피언스리그"],
    display: "UEFA 챔피언스리그",
    sport: "축구",
    title: "챔피언스리그 중계 편성표 | UCL 한국어 해설 - 한해설",
    description:
      "UEFA 챔피언스리그(UCL) 중계 편성표. 유럽 최고의 클럽 대항전 한국어 해설 중계 일정.",
    keywords: ["챔피언스리그 중계", "UCL 중계", "챔스 중계", "챔피언스리그 편성표", "UEFA 중계"],
    intro:
      "UEFA 챔피언스리그(UCL) 한국어 해설 중계 편성표입니다. 유럽 축구 최고의 무대를 한국어 해설로 시청하세요.",
  },
  {
    slug: "europa-league",
    match: ["유로파리그", "UEFA 유로파리그"],
    display: "UEFA 유로파리그",
    sport: "축구",
    title: "유로파리그 중계 편성표 | UEL 한국어 해설 - 한해설",
    description:
      "UEFA 유로파리그 중계 편성표. 한국어 해설 중계 일정을 플랫폼별로 확인하세요.",
    keywords: ["유로파리그 중계", "UEL 중계", "유로파리그 편성표"],
    intro: "UEFA 유로파리그 한국어 해설 중계 편성표입니다.",
  },
  {
    slug: "conference-league",
    match: ["컨퍼런스리그", "UEFA 컨퍼런스리그"],
    display: "UEFA 컨퍼런스리그",
    sport: "축구",
    title: "컨퍼런스리그 중계 편성표 | 한국어 해설 - 한해설",
    description: "UEFA 컨퍼런스리그 중계 편성표. 한국어 해설 일정.",
    keywords: ["컨퍼런스리그 중계", "UECL 중계", "컨퍼런스리그 편성표"],
    intro: "UEFA 컨퍼런스리그 한국어 해설 중계 편성표입니다.",
  },
  {
    slug: "mls",
    match: ["MLS"],
    display: "MLS",
    sport: "축구",
    title: "MLS 중계 편성표 | 메시·손흥민 한국어 해설 - 한해설",
    description: "미국 MLS 중계 편성표. 인터 마이애미, LA 갤럭시 등 주요 경기 한국어 해설 일정.",
    keywords: ["MLS 중계", "메시 중계", "인터 마이애미 중계", "MLS 편성표", "미국 축구"],
    intro: "MLS(메이저 리그 사커) 한국어 해설 중계 편성표입니다. 메시가 뛰는 인터 마이애미 경기 일정.",
  },
  {
    slug: "k-league-1",
    match: ["K리그1"],
    display: "K리그1",
    sport: "축구",
    title: "K리그1 중계 편성표 | 한국 프로축구 1부 - 한해설",
    description: "K리그1 중계 편성표. 울산, 전북, 포항 등 한국 프로축구 1부 경기 일정.",
    keywords: ["K리그1 중계", "K리그 중계", "K리그1 편성표", "한국 프로축구"],
    intro: "K리그1(한국 프로축구 1부) 중계 편성표입니다. 국내 모든 중계 플랫폼 일정을 한눈에.",
  },
  {
    slug: "k-league-2",
    match: ["K리그2"],
    display: "K리그2",
    sport: "축구",
    title: "K리그2 중계 편성표 | 한국 프로축구 2부 - 한해설",
    description: "K리그2 중계 편성표. 한국 프로축구 2부 경기 일정.",
    keywords: ["K리그2 중계", "K리그2 편성표"],
    intro: "K리그2(한국 프로축구 2부) 중계 편성표입니다.",
  },
  {
    slug: "afc-champions-league",
    match: ["AFC 챔피언스리그 엘리트", "AFC 챔피언스리그 2", "AFC 챔피언스리그"],
    display: "AFC 챔피언스리그",
    sport: "축구",
    title: "AFC 챔피언스리그 중계 편성표 | ACL 한국어 해설 - 한해설",
    description: "AFC 챔피언스리그 엘리트/2 중계 편성표. 울산·전북 등 K리그 팀 경기 한국어 해설 일정.",
    keywords: ["AFC 챔피언스리그 중계", "ACL 중계", "AFC 챔스", "AFC 챔피언스리그 편성표"],
    intro: "AFC 챔피언스리그 한국어 해설 중계 편성표입니다.",
  },
  {
    slug: "mlb",
    match: ["MLB"],
    display: "MLB (메이저리그)",
    sport: "야구",
    title: "MLB 중계 편성표 | 메이저리그 한국어 해설 - 한해설",
    description: "MLB(메이저리그) 중계 편성표. 다저스, 양키스 등 주요 경기 한국어 해설 일정.",
    keywords: ["MLB 중계", "MLB 한국어중계", "메이저리그 중계", "다저스 중계", "김하성 중계", "MLB 편성표"],
    intro: "MLB(메이저리그) 한국어 해설 중계 편성표입니다. 한국 선수가 뛰는 모든 경기를 놓치지 마세요.",
  },
  {
    slug: "kbo",
    match: ["KBO"],
    display: "KBO (한국 프로야구)",
    sport: "야구",
    title: "KBO 중계 편성표 | 한국 프로야구 - 한해설",
    description: "KBO 리그 중계 편성표. 두산, LG, 키움 등 한국 프로야구 경기 일정.",
    keywords: ["KBO 중계", "KBO 편성표", "한국 프로야구", "프로야구 중계"],
    intro: "KBO 리그(한국 프로야구) 중계 편성표입니다. 모든 플랫폼 편성 일정을 한눈에.",
  },
  {
    slug: "kbl",
    match: ["KBL", "프로농구"],
    display: "KBL (한국 프로농구)",
    sport: "농구",
    title: "KBL 중계 편성표 | 한국 프로농구 - 한해설",
    description: "KBL(한국 프로농구) 중계 편성표. 경기 일정과 중계 플랫폼을 확인하세요.",
    keywords: ["KBL 중계", "KBL 편성표", "한국 프로농구", "프로농구 중계"],
    intro: "KBL(한국 프로농구) 중계 편성표입니다.",
  },
];

export const PLATFORM_SEO: SeoMeta[] = [
  {
    slug: "spotv-now",
    match: ["SPOTV NOW"],
    display: "SPOTV NOW",
    title: "SPOTV NOW 편성표 | 스포티비 나우 한국어 중계 - 한해설",
    description: "SPOTV NOW(스포티비 나우) 편성표. EPL, MLB, UFC 등 한국어 해설 중계 일정.",
    keywords: ["SPOTV NOW 편성표", "스포티비 나우 편성표", "SPOTV NOW 중계", "스포티비 나우 중계", "SPOTV NOW EPL"],
    intro: "SPOTV NOW(스포티비 나우)의 한국어 중계 편성표입니다. EPL, MLB 등 주요 경기를 확인하세요.",
  },
  {
    slug: "coupang-play",
    match: ["쿠팡플레이"],
    display: "쿠팡플레이",
    title: "쿠팡플레이 편성표 | 쿠팡 스포츠 중계 - 한해설",
    description:
      "쿠팡플레이 스포츠 중계 편성표. K리그, MLB, NFL, F1 등 쿠팡플레이 독점 중계 일정.",
    keywords: ["쿠팡플레이 편성표", "쿠팡 플레이 편성표", "쿠팡플레이 중계", "쿠팡플레이 K리그", "쿠팡플레이 MLB"],
    intro:
      "쿠팡플레이 스포츠 중계 편성표입니다. K리그, NFL, MLB 등 쿠팡플레이 독점/공동 중계 일정을 확인하세요.",
  },
  {
    slug: "tving",
    match: ["티빙"],
    display: "티빙",
    title: "티빙 스포츠 편성표 | 티빙 KBO·KBL 중계 - 한해설",
    description: "티빙 스포츠 중계 편성표. KBO(한국 프로야구), KBL(프로농구) 등 티빙 독점 중계 일정.",
    keywords: ["티빙 편성표", "티빙 스포츠 편성표", "티빙 KBO", "티빙 KBL", "티빙 중계"],
    intro: "티빙(TVING) 스포츠 중계 편성표입니다. KBO, KBL 등 티빙 독점 중계를 확인하세요.",
  },
  {
    slug: "apple-tv",
    match: ["Apple TV+"],
    display: "Apple TV+",
    title: "Apple TV+ 스포츠 편성표 | MLS 중계 - 한해설",
    description: "Apple TV+ 스포츠 편성표. MLS(메시의 인터 마이애미) 중계 일정.",
    keywords: ["Apple TV 편성표", "Apple TV 스포츠", "Apple TV MLS", "애플티비 중계"],
    intro: "Apple TV+ 스포츠 중계 편성표입니다. MLS Season Pass 중계 일정을 확인하세요.",
  },
  {
    slug: "spotv",
    match: ["SPOTV"],
    display: "SPOTV",
    title: "SPOTV 편성표 | 스포티비 TV 채널 중계 - 한해설",
    description: "SPOTV TV 채널 편성표. 라이브 스포츠 중계 일정.",
    keywords: ["SPOTV 편성표", "스포티비 편성표", "SPOTV 중계", "SPOTV 채널"],
    intro: "SPOTV TV 채널의 실시간(LIVE) 스포츠 중계 편성표입니다.",
  },
  {
    slug: "spotv2",
    match: ["SPOTV2"],
    display: "SPOTV2",
    title: "SPOTV2 편성표 | 스포티비2 TV 채널 - 한해설",
    description: "SPOTV2 TV 채널 편성표. 라이브 스포츠 중계 일정.",
    keywords: ["SPOTV2 편성표", "스포티비2 편성표", "SPOTV2 중계"],
    intro: "SPOTV2 TV 채널의 실시간(LIVE) 스포츠 중계 편성표입니다.",
  },
  {
    slug: "tvn-sports",
    match: ["tvN SPORTS"],
    display: "tvN SPORTS",
    title: "tvN SPORTS 편성표 | tvN 스포츠 채널 중계 - 한해설",
    description: "tvN SPORTS 채널 편성표. EPL, KBO, ATP 테니스 등 한국어 중계 일정.",
    keywords: ["tvN SPORTS 편성표", "tvN 스포츠 편성표", "tvN SPORTS 중계", "tvN EPL"],
    intro: "tvN SPORTS 채널 편성표입니다. EPL, KBO 등 한국어 중계 일정.",
  },
  {
    slug: "kbs-n-sports",
    match: ["KBS N SPORTS"],
    display: "KBS N SPORTS",
    title: "KBS N SPORTS 편성표 | 한국어 중계 - 한해설",
    description: "KBS N SPORTS 채널 편성표. KBO, 프로배구 등 한국어 중계 일정.",
    keywords: ["KBS N SPORTS 편성표", "KBS N 편성표", "KBS N 중계"],
    intro: "KBS N SPORTS 채널 편성표입니다.",
  },
  {
    slug: "mbc-sports-plus",
    match: ["MBC SPORTS+"],
    display: "MBC SPORTS+",
    title: "MBC SPORTS+ 편성표 | 한국어 중계 - 한해설",
    description: "MBC SPORTS+ 채널 편성표. KBO, 프로축구 등 한국어 중계 일정.",
    keywords: ["MBC SPORTS+ 편성표", "MBC 스포츠 플러스 편성표", "MBC SPORTS+ 중계"],
    intro: "MBC SPORTS+ 채널 편성표입니다.",
  },
  {
    slug: "sbs-sports",
    match: ["SBS Sports"],
    display: "SBS Sports",
    title: "SBS Sports 편성표 | 한국어 중계 - 한해설",
    description: "SBS Sports 채널 편성표. KBO, 프로농구 등 한국어 중계 일정.",
    keywords: ["SBS Sports 편성표", "SBS 스포츠 편성표", "SBS Sports 중계"],
    intro: "SBS Sports 채널 편성표입니다.",
  },
];

export function findLeagueBySlug(slug: string): SeoMeta | undefined {
  return LEAGUE_SEO.find((l) => l.slug === slug);
}

export function findPlatformBySlug(slug: string): SeoMeta | undefined {
  return PLATFORM_SEO.find((p) => p.slug === slug);
}
