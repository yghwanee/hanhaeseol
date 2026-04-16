export type PlatformGuide = {
  type: "ott" | "tv";
  price?: string;
  freeOption?: string;
  signupUrl?: string;
  sports: string[];
  channels?: string[];
  howToWatch: string;
  features?: string[];
};

export const PLATFORM_GUIDES: Record<string, PlatformGuide> = {
  "spotv-now": {
    type: "ott",
    price: "프리미엄 월 13,900원 / 스탠다드 월 9,900원",
    signupUrl: "https://www.spotvnow.co.kr",
    sports: ["EPL", "라리가", "세리에A", "분데스리가", "MLB", "UFC", "리그1", "챔피언스리그"],
    howToWatch:
      "SPOTV NOW 웹사이트 또는 앱에서 회원가입 후 구독권을 구매하면 시청할 수 있습니다. 모바일, PC, 스마트TV에서 모두 이용 가능합니다.",
    features: [
      "해외축구 5대 리그 + UEFA 대회 독점 중계",
      "한국어 해설 및 현지 해설 선택 가능",
      "최대 4개 기기 동시 시청 (프리미엄)",
      "경기 하이라이트 및 다시보기 제공",
    ],
  },
  "coupang-play": {
    type: "ott",
    price: "로켓와우 월 7,890원 (쿠팡플레이 포함)",
    freeOption: "쿠팡 로켓와우 회원이면 추가 비용 없이 시청 가능",
    signupUrl: "https://www.coupangplay.com",
    sports: ["K리그", "MLB", "리그1", "NFL"],
    howToWatch:
      "쿠팡 로켓와우 회원이면 쿠팡플레이 앱에서 바로 시청 가능합니다. 별도 가입 없이 쿠팡 계정으로 로그인하면 됩니다.",
    features: [
      "로켓와우 멤버십으로 쿠팡 무료배송 + 스포츠 중계",
      "K리그 전 경기 독점 생중계",
      "한국어 해설 제공",
      "모바일, PC, 스마트TV 지원",
    ],
  },
  tving: {
    type: "ott",
    price: "프리미엄 월 17,000원 / 스탠다드 월 13,500원 / 베이직 월 9,500원",
    signupUrl: "https://www.tving.com",
    sports: ["KBO", "KBL"],
    howToWatch:
      "티빙 웹사이트 또는 앱에서 구독권을 구매하면 시청할 수 있습니다. KBO, KBL 등 국내 프로스포츠를 중계합니다.",
    features: [
      "KBO(프로야구) 전 경기 생중계",
      "KBL(프로농구) 생중계",
      "드라마, 예능, 영화도 함께 이용 가능",
      "최대 4명 동시 시청 (프리미엄)",
    ],
  },
  "apple-tv": {
    type: "ott",
    price: "Apple TV+ 월 9,900원 / MLS Season Pass 별도",
    signupUrl: "https://tv.apple.com",
    sports: ["MLS"],
    howToWatch:
      "Apple TV 앱에서 MLS Season Pass를 구독하면 시청할 수 있습니다. Apple 기기 외에도 삼성/LG 스마트TV, 게임 콘솔 등에서 이용 가능합니다.",
    features: [
      "MLS 전 경기 독점 생중계",
      "Apple 기기 + 일부 스마트TV/콘솔 지원",
      "현지 해설(영어) 중심 제공",
    ],
  },
  spotv: {
    type: "tv",
    channels: ["SPOTV (케이블/IPTV 채널)"],
    sports: ["EPL", "라리가", "MLB", "분데스리가"],
    howToWatch:
      "케이블TV 또는 IPTV(KT olleh tv, SK Btv, LG U+tv)에서 SPOTV 채널을 통해 시청할 수 있습니다.",
    features: [
      "케이블/IPTV 가입자 무료 시청",
      "한국어 해설 중계",
      "주요 빅매치 위주 편성",
    ],
  },
  spotv2: {
    type: "tv",
    channels: ["SPOTV2 (케이블/IPTV 채널)"],
    sports: ["EPL", "라리가", "세리에A", "MLB"],
    howToWatch:
      "케이블TV 또는 IPTV에서 SPOTV2 채널을 통해 시청할 수 있습니다. SPOTV와 함께 다양한 리그를 분산 편성합니다.",
    features: [
      "SPOTV와 함께 다양한 리그 동시 편성",
      "케이블/IPTV 가입자 무료 시청",
      "한국어 해설 중계",
    ],
  },
  "tvn-sports": {
    type: "tv",
    channels: ["tvN SPORTS (케이블/IPTV 채널)"],
    sports: ["EPL", "KBO", "ATP 테니스"],
    howToWatch:
      "케이블TV 또는 IPTV에서 tvN SPORTS 채널을 통해 시청할 수 있습니다. 티빙 구독자는 실시간 TV로도 시청 가능합니다.",
    features: [
      "EPL 주요 경기 중계",
      "KBO 프로야구 중계",
      "케이블/IPTV 가입자 무료 시청",
      "티빙에서 실시간 시청 가능",
    ],
  },
  "kbs-n-sports": {
    type: "tv",
    channels: ["KBS N SPORTS (케이블/IPTV 채널)"],
    sports: ["KBO", "프로배구", "프로농구"],
    howToWatch:
      "케이블TV 또는 IPTV에서 KBS N SPORTS 채널을 통해 시청할 수 있습니다.",
    features: [
      "KBO 프로야구 중계",
      "V리그 프로배구 중계",
      "케이블/IPTV 가입자 무료 시청",
    ],
  },
  "mbc-sports-plus": {
    type: "tv",
    channels: ["MBC SPORTS+ (케이블/IPTV 채널)"],
    sports: ["KBO", "프로배구", "프로축구"],
    howToWatch:
      "케이블TV 또는 IPTV에서 MBC SPORTS+ 채널을 통해 시청할 수 있습니다.",
    features: [
      "KBO 프로야구 중계",
      "V리그 프로배구 중계",
      "케이블/IPTV 가입자 무료 시청",
    ],
  },
  "sbs-sports": {
    type: "tv",
    channels: ["SBS Sports (케이블/IPTV 채널)"],
    sports: ["KBO", "프로농구", "골프"],
    howToWatch:
      "케이블TV 또는 IPTV에서 SBS Sports 채널을 통해 시청할 수 있습니다.",
    features: [
      "KBO 프로야구 중계",
      "KBL 프로농구 중계",
      "케이블/IPTV 가입자 무료 시청",
    ],
  },
};
