// 영어 팀명 (freesupertips) → 한국어 팀명 (schedule.json)
export const TEAM_NAME_MAP: Record<string, string> = {
  // === EPL (20팀) ===
  "Arsenal": "아스날",
  "Aston Villa": "아스톤 빌라",
  "Bournemouth": "본머스",
  "Brentford": "브렌트포드",
  "Brighton": "브라이턴",
  "Chelsea": "첼시",
  "Crystal Palace": "크리스탈 팰리스",
  "Everton": "에버턴",
  "Fulham": "풀럼",
  "Ipswich": "입스위치",
  "Leicester": "레스터",
  "Liverpool": "리버풀",
  "Manchester City": "맨시티",
  "Manchester United": "맨유",
  "Newcastle": "뉴캐슬",
  "Nottingham Forest": "노팅엄",
  "Southampton": "사우샘프턴",
  "Tottenham": "토트넘",
  "West Ham": "웨스트햄",
  "Wolverhampton": "울버햄튼",
  "Wolves": "울버햄튼",
  "Sunderland": "선덜랜드",
  "Leeds": "리즈",

  // === 라리가 (20팀) ===
  "Atletico Madrid": "AT.마드리드",
  "Athletic Bilbao": "아틀레틱",
  "Athletic Club": "아틀레틱",
  "Barcelona": "바르셀로나",
  "Real Betis": "레알 베티스",
  "Celta Vigo": "셀타 비고",
  "Espanyol": "에스파뇰",
  "Getafe": "헤타페",
  "Girona": "지로나",
  "Las Palmas": "라스팔마스",
  "Leganes": "레가네스",
  "Mallorca": "마요르카",
  "Osasuna": "오사수나",
  "Rayo Vallecano": "라요 바예카노",
  "Real Madrid": "레알 마드리드",
  "Real Sociedad": "레알 소시에다드",
  "Sevilla": "세비야",
  "Valencia": "발렌시아",
  "Valladolid": "바야돌리드",
  "Villarreal": "비야레알",
  "Levante": "레반테",
  "Cadiz": "카디스",
  "Real Oviedo": "레알 오비에도",

  // === 세리에A (20팀) ===
  "AC Milan": "AC 밀란",
  "Atalanta": "아탈란타",
  "Bologna": "볼로냐",
  "Cagliari": "칼리아리 칼초",
  "Como": "코모 1907",
  "Empoli": "엠폴리",
  "Fiorentina": "피오렌티나",
  "Genoa": "제노아",
  "Inter Milan": "인터 밀란",
  "Juventus": "유벤투스",
  "Lazio": "라치오",
  "Lecce": "레체",
  "Monza": "몬차",
  "Napoli": "나폴리",
  "Parma": "파르마 칼초",
  "Roma": "로마",
  "Sassuolo": "사수올로 칼초",
  "Torino": "토리노",
  "Udinese": "우디네세 칼초",
  "Venezia": "베네치아",
  "Verona": "베로나",

  // === 분데스리가 (18팀) ===
  "Augsburg": "아우크스부르크",
  "Bayern Munich": "바이에른 뮌헨",
  "Bayer Leverkusen": "레버쿠젠",
  "Leverkusen": "레버쿠젠",
  "Borussia Dortmund": "도르트문트",
  "Dortmund": "도르트문트",
  "Borussia Monchengladbach": "묀헨글라트바흐",
  "Eintracht Frankfurt": "프랑크푸르트",
  "Frankfurt": "프랑크푸르트",
  "Freiburg": "프라이부르크",
  "SC Freiburg": "프라이부르크",
  "Heidenheim": "하이덴하임",
  "Hoffenheim": "호펜하임",
  "Holstein Kiel": "홀슈타인 킬",
  "Mainz": "마인츠",
  "RB Leipzig": "라이프치히",
  "Leipzig": "라이프치히",
  "St Pauli": "장크트파울리",
  "Stuttgart": "슈투트가르트",
  "Union Berlin": "우니온 베를린",
  "Werder Bremen": "베르더 브레멘",
  "Wolfsburg": "볼프스부르크",
  "Cologne": "쾰른",
  "Koln": "쾰른",
  "Hamburg": "함부르크",

  // === 리그1 ===
  "Lyon": "리옹",
  "Marseille": "마르세유",
  "Monaco": "모나코",
  "Nice": "니스",
  "Lille": "릴",
  "Lens": "랑스",
  "Rennes": "스타드 렌",
  "Stade Rennais": "스타드 렌",
  "Toulouse": "툴루즈",
  "Nantes": "낭트",
  "Strasbourg": "RC 스트라스부르",
  "Montpellier": "몽펠리에",
  "Reims": "랑스",
  "Le Havre": "르 아브르",
  "Auxerre": "오세르",
  "Angers": "앙제",
  "Lorient": "로리앙",
  "Brest": "브레스트",
  "Saint-Etienne": "생테티엔",

  // === 챔피언십 등 하위리그 ===
  "Birmingham": "버밍엄",
  "Wrexham": "렉섬",
  "Hull City": "헐 시티",
  "Hull": "헐 시티",
  "Blackburn": "블랙번",
  "Coventry": "코번트리",
  "Stockport": "스톡포트",
  "Luton": "루턴",

  // === 챔피언스리그 등 추가 ===
  "PSG": "파리 생제르망",
  "Paris Saint-Germain": "파리 생제르망",
  "Porto": "FC 포르투",
  "FC Porto": "FC 포르투",
  "Sporting CP": "스포르팅 CP",
  "Benfica": "벤피카",
  "Club Brugge": "클뤼프 브뤼헤",
};

// 리그명 매핑 (freesupertips → schedule.json)
export const LEAGUE_NAME_MAP: Record<string, string> = {
  "Premier League": "프리미어리그",
  "England Premier League": "프리미어리그",
  "La Liga": "라리가",
  "Spanish La Liga": "라리가",
  "Serie A": "세리에A",
  "Italian Serie A": "세리에A",
  "Bundesliga": "분데스리가",
  "German Bundesliga": "분데스리가",
  "Champions League": "챔피언스리그",
  "UEFA Champions League": "챔피언스리그",
  "Europa League": "유로파리그",
  "Conference League": "컨퍼런스리그",
};

// 영어 팀명으로 한국어 팀명 찾기 (부분 매칭 지원)
export function findKoreanTeamName(englishName: string): string | null {
  // 정확한 매칭
  if (TEAM_NAME_MAP[englishName]) return TEAM_NAME_MAP[englishName];

  // 대소문자 무시 매칭
  const lower = englishName.toLowerCase();
  for (const [en, ko] of Object.entries(TEAM_NAME_MAP)) {
    if (en.toLowerCase() === lower) return ko;
  }

  // 부분 매칭 (영어 팀명이 포함되거나 포함하는 경우)
  for (const [en, ko] of Object.entries(TEAM_NAME_MAP)) {
    if (lower.includes(en.toLowerCase()) || en.toLowerCase().includes(lower)) {
      return ko;
    }
  }

  return null;
}

// 한국어 팀명으로 영어 팀명 찾기
export function findEnglishTeamName(koreanName: string): string | null {
  for (const [en, ko] of Object.entries(TEAM_NAME_MAP)) {
    if (ko === koreanName) return en;
  }
  return null;
}
