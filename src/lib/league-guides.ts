export type LeagueGuide = {
  season?: string;
  broadcasters?: string[];
  koreanCommentary?: string;
  gameTime?: string;
  notableTeams?: string[];
  highlights?: string[];
};

export const LEAGUE_GUIDES: Record<string, LeagueGuide> = {
  epl: {
    season: "매년 8월 ~ 다음해 5월 (38라운드)",
    broadcasters: ["쿠팡플레이", "SPOTV NOW", "SPOTV", "SPOTV2", "tvN SPORTS"],
    koreanCommentary: "전 경기 한국어 해설 제공",
    gameTime: "주로 한국 시간 토·일 23:00 ~ 다음날 04:00",
    notableTeams: [
      "맨체스터 시티",
      "리버풀",
      "맨체스터 유나이티드",
      "아스널",
      "첼시",
      "토트넘",
    ],
    highlights: [
      "노스웨스트 더비(맨유 vs 리버풀), 북런던 더비(아스널 vs 토트넘) 등 빅매치 다수",
      "한국 선수가 뛰는 팀 경기는 특히 한국어 해설로 시청 가능",
      "쿠팡플레이는 와우 멤버십 가입자에게 추가 비용 없이 제공",
    ],
  },
  laliga: {
    season: "매년 8월 ~ 다음해 5월 (38라운드)",
    broadcasters: ["쿠팡플레이"],
    koreanCommentary: "주요 경기 위주로 한국어 해설 제공",
    gameTime: "주로 한국 시간 토·일 새벽 ~ 새벽 06:00",
    notableTeams: [
      "레알 마드리드",
      "FC 바르셀로나",
      "아틀레티코 마드리드",
      "세비야",
      "비야레알",
    ],
    highlights: [
      "엘 클라시코(레알 vs 바르셀로나)는 시즌 최대 빅매치",
      "마드리드 더비(레알 vs 아틀레티코)도 주목 필요",
      "이강인 선수 PSG 이적 후 한국 시청자 관심은 다소 분산",
    ],
  },
  bundesliga: {
    season: "매년 8월 ~ 다음해 5월 (34라운드)",
    broadcasters: ["쿠팡플레이"],
    koreanCommentary: "주요 경기 한국어 해설 제공",
    gameTime: "주로 한국 시간 토·일 23:00 ~ 04:00",
    notableTeams: [
      "바이에른 뮌헨",
      "보루시아 도르트문트",
      "RB 라이프치히",
      "레버쿠젠",
    ],
    highlights: [
      "데어 클라시커(뮌헨 vs 도르트문트)가 최대 라이벌전",
      "김민재 선수가 뛰는 바이에른 뮌헨 경기는 한국어 중계 가능성 높음",
      "주말 단일 경기 외 토요일 한 라운드 동시 진행 라운드 존재",
    ],
  },
  seriea: {
    season: "매년 8월 ~ 다음해 5월 (38라운드)",
    broadcasters: ["SPOTV NOW", "SPOTV2"],
    koreanCommentary: "주요 빅매치 한국어 해설 제공",
    gameTime: "주로 한국 시간 토·일 새벽 ~ 새벽 05:00",
    notableTeams: [
      "유벤투스",
      "AC 밀란",
      "인터 밀란",
      "나폴리",
      "AS 로마",
      "라치오",
    ],
    highlights: [
      "데르비 델라 마돈니나(AC 밀란 vs 인터 밀란)와 데르비 디탈리아(유벤투스 vs 인터)가 핵심 빅매치",
      "수비 전술 발달한 리그라 0-0, 1-0 경기도 자주 발생",
      "SPOTV NOW에서 풀 라운드 시청 가능",
    ],
  },
  ligue1: {
    season: "매년 8월 ~ 다음해 5월 (34라운드, 2023-24부터 18팀 체제)",
    broadcasters: ["쿠팡플레이"],
    koreanCommentary: "주요 경기 한국어 해설 제공",
    gameTime: "주로 한국 시간 토·일 새벽 ~ 새벽 05:00",
    notableTeams: [
      "PSG (파리 생제르맹)",
      "올림피크 마르세유",
      "AS 모나코",
      "릴 OSC",
    ],
    highlights: [
      "PSG가 사실상 우승을 독점하는 구조",
      "이강인 선수 합류로 PSG 경기에 대한 한국 시청자 관심 매우 큼",
      "르 클라시크(PSG vs 마르세유)가 시즌 최대 빅매치",
    ],
  },
  "champions-league": {
    season: "매년 9월 ~ 다음해 5월 (조별리그 + 토너먼트)",
    broadcasters: ["쿠팡플레이", "tvN SPORTS"],
    koreanCommentary: "전 경기 한국어 해설 제공",
    gameTime: "주로 한국 시간 화·수 새벽 04:00, 일부 02:00",
    notableTeams: [
      "레알 마드리드",
      "맨체스터 시티",
      "바이에른 뮌헨",
      "PSG",
      "리버풀",
      "아스널",
    ],
    highlights: [
      "유럽 최고 클럽들이 격돌하는 최대 권위의 클럽 대항전",
      "조별리그(매치데이 1~6) 후 16강~결승 토너먼트 진행",
      "결승전은 5월 말~6월 초 단판 경기로 개최",
      "tvN SPORTS는 빅매치 위주, 쿠팡플레이는 풀 라인업 중계",
    ],
  },
  "europa-league": {
    season: "매년 9월 ~ 다음해 5월",
    broadcasters: ["쿠팡플레이"],
    koreanCommentary: "주요 경기 한국어 해설 제공",
    gameTime: "주로 한국 시간 목요일 새벽 02:00 / 05:00",
    notableTeams: [
      "AS 로마",
      "맨체스터 유나이티드",
      "토트넘",
      "리버풀 (시즌별 변동)",
    ],
    highlights: [
      "UEFA 챔피언스리그 다음 단계 클럽 대항전",
      "결승 우승팀은 다음 시즌 챔피언스리그 출전권 획득",
      "챔스 조별리그 3위 팀이 합류해 토너먼트 진행",
    ],
  },
  "conference-league": {
    season: "매년 9월 ~ 다음해 5월",
    broadcasters: ["쿠팡플레이"],
    koreanCommentary: "한국어 해설 제한적",
    gameTime: "주로 한국 시간 목요일 새벽",
    highlights: [
      "UEFA 3부 격 클럽 대항전 (2021-22 신설)",
      "비교적 작은 리그 클럽들도 유럽 무대 경험 가능",
      "한국 시청자 관심도는 챔스·유로파 대비 낮은 편",
    ],
  },
  mls: {
    season: "매년 2월 ~ 12월 (북미 시즌)",
    broadcasters: ["Apple TV+ (MLS Season Pass)"],
    koreanCommentary: "현지 해설(영어) 중심, 일부 한국어 해설 제공",
    gameTime: "주로 한국 시간 토·일 오전 (북미 동부 기준 저녁 경기)",
    notableTeams: [
      "인터 마이애미 (메시 소속)",
      "LA FC",
      "LA 갤럭시",
      "시애틀 사운더스",
    ],
    highlights: [
      "리오넬 메시가 인터 마이애미에서 뛰면서 글로벌 관심도 폭증",
      "Apple TV+의 MLS Season Pass로 전 경기 시청 가능",
      "정규 시즌(이스턴/웨스턴 컨퍼런스) 후 플레이오프 진행",
    ],
  },
  "k-league-1": {
    season: "매년 2월 말 ~ 11월 (38라운드, 스플릿 시스템)",
    broadcasters: ["쿠팡플레이"],
    koreanCommentary: "전 경기 한국어 해설 (국내 리그)",
    gameTime: "주로 주말 14:00 ~ 19:30, 평일 19:30",
    notableTeams: [
      "울산 HD",
      "전북 현대",
      "FC 서울",
      "포항 스틸러스",
      "수원 삼성 (시즌별 변동)",
    ],
    highlights: [
      "33라운드 후 상위 6팀(파이널 A) / 하위 6팀(파이널 B)으로 스플릿",
      "쿠팡플레이가 K리그 전 경기 독점 생중계",
      "ACL(AFC 챔피언스리그) 출전권은 리그 상위 4팀에 부여",
    ],
  },
  "k-league-2": {
    season: "매년 3월 ~ 11월 (한국 프로축구 2부)",
    broadcasters: ["쿠팡플레이"],
    koreanCommentary: "전 경기 한국어 해설",
    gameTime: "주로 주말 13:00 ~ 17:00",
    highlights: [
      "K리그1 강등팀과 승강 플레이오프로 1부 승격팀 결정",
      "쿠팡플레이가 K리그2도 함께 중계",
      "젊은 유망주들이 1군 무대 경험을 쌓는 리그",
    ],
  },
  "afc-champions-league": {
    season: "매년 9월 ~ 다음해 5월",
    broadcasters: ["쿠팡플레이", "tvN SPORTS", "SPOTV"],
    koreanCommentary: "K리그 팀 경기 위주 한국어 해설",
    gameTime: "주로 한국 시간 화·수 18:00 ~ 23:00",
    notableTeams: [
      "울산 HD",
      "전북 현대",
      "포항 스틸러스",
      "요코하마 F. 마리노스",
      "알 힐랄",
    ],
    highlights: [
      "2024-25 시즌부터 ACL 엘리트와 ACL 2 두 대회로 분리 운영",
      "K리그 팀 경기는 거의 모든 한국 플랫폼에서 한국어 중계",
      "결승 진출 시 FIFA 클럽 월드컵 출전권 획득",
    ],
  },
  mlb: {
    season: "매년 3월 말 ~ 10월 (정규 162경기 + 포스트시즌)",
    broadcasters: ["SPOTV NOW", "SPOTV", "SPOTV2", "tvN SPORTS"],
    koreanCommentary: "한국 선수 출전 경기 위주 한국어 해설",
    gameTime: "주로 한국 시간 오전 8:00 ~ 정오, 일부 새벽",
    notableTeams: [
      "LA 다저스",
      "샌디에이고 파드레스",
      "뉴욕 양키스",
      "보스턴 레드삭스",
      "토론토 블루제이스",
    ],
    highlights: [
      "한국 선수(김하성, 이정후 등) 출전 경기는 우선 중계 편성",
      "10월 포스트시즌(와일드카드 → 디비전 → 챔피언십 → 월드시리즈)이 하이라이트",
      "SPOTV가 MLB 한국 독점권 보유, 빅매치는 풀 한국어 중계",
    ],
  },
  kbo: {
    season: "매년 3월 말 ~ 11월 (정규 144경기 + 포스트시즌)",
    broadcasters: ["티빙", "SPOTV", "tvN SPORTS", "KBS N SPORTS", "MBC SPORTS+", "SBS Sports"],
    koreanCommentary: "전 경기 한국어 해설",
    gameTime: "평일 18:30, 주말 14:00 / 17:00",
    notableTeams: [
      "두산 베어스",
      "LG 트윈스",
      "키움 히어로즈",
      "삼성 라이온즈",
      "KIA 타이거즈",
      "SSG 랜더스",
    ],
    highlights: [
      "티빙이 2024-2026년 KBO 디지털 독점 중계권 보유",
      "TV 채널은 케이블/IPTV 가입자라면 무료 시청 가능",
      "정규 시즌 후 와일드카드 → 준PO → PO → 한국시리즈 진행",
    ],
  },
  kbl: {
    season: "매년 10월 ~ 다음해 4월",
    broadcasters: ["티빙", "SBS Sports", "KBS N SPORTS"],
    koreanCommentary: "전 경기 한국어 해설",
    gameTime: "평일 19:00, 주말 14:00 / 16:00",
    notableTeams: [
      "서울 SK 나이츠",
      "수원 KT 소닉붐",
      "안양 정관장",
      "원주 DB 프로미",
    ],
    highlights: [
      "정규 시즌(54경기) 후 6강 플레이오프 → 4강 → 챔피언결정전",
      "티빙에서 디지털 라이브 시청 가능",
      "한국 농구 최고 무대로 외국인 선수 활약도 큰 비중",
    ],
  },
};
