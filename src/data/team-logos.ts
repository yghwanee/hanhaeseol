const MLB = (abbr: string) => `https://a.espncdn.com/i/teamlogos/mlb/500/${abbr}.png`;
const NBA = (abbr: string) => `https://a.espncdn.com/i/teamlogos/nba/500/${abbr}.png`;
const SOC = (id: number) => `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`;
const KBO_LOGO = (code: string) => `/logos/kbo/${code}.png`;

export const TEAM_LOGOS: Record<string, string> = {
  // MLB
  "LA 다저스": MLB("lad"),
  "LA 에인절스": MLB("laa"),
  "뉴욕 메츠": MLB("nym"),
  "뉴욕 양키스": MLB("nyy"),
  "볼티모어 오리올스": MLB("bal"),
  "샌디에이고 파드리스": MLB("sd"),
  "샌프란시스코 자이언츠": MLB("sf"),
  "시애틀 매리너스": MLB("sea"),
  "신시내티 레즈": MLB("cin"),
  "워싱턴 내셔널스": MLB("wsh"),
  "콜로라도 로키스": MLB("col"),
  "탬파베이 레이스": MLB("tb"),
  "텍사스 레인저스": MLB("tex"),
  "피츠버그 파이리츠": MLB("pit"),
  "애리조나 다이아몬드백스": MLB("ari"),
  "애슬레틱스": MLB("oak"),
  "오클랜드 애슬레틱스": MLB("oak"),
  "미네소타 트윈스": MLB("min"),
  "보스턴 레드삭스": MLB("bos"),
  "필라델피아 필리스": MLB("phi"),
  "시카고 컵스": MLB("chc"),
  "시카고 화이트삭스": MLB("chw"),
  "마이애미 말린스": MLB("mia"),
  "애틀랜타 브레이브스": MLB("atl"),
  "휴스턴 애스트로스": MLB("hou"),
  "세인트루이스 카디널스": MLB("stl"),
  "클리블랜드 가디언스": MLB("cle"),
  "밀워키 브루어스": MLB("mil"),
  "토론토 블루제이스": MLB("tor"),
  "디트로이트 타이거스": MLB("det"),
  "캔자스시티 로열스": MLB("kc"),

  // NBA
  "LA 레이커스": NBA("lal"),
  "덴버": NBA("den"),
  "샌안토니오": NBA("sa"),
  "유타": NBA("utah"),
  "휴스턴": NBA("hou"),

  // EPL
  "리버풀": SOC(364),
  "리즈": SOC(357),
  "맨시티": SOC(382),
  "맨유": SOC(360),
  "선덜랜드": SOC(366),
  "첼시": SOC(363),
  "토트넘": SOC(367),
  "풀럼": SOC(370),
  "아스톤 빌라": SOC(362),
  "크리스탈 팰리스": SOC(384),
  "뉴캐슬": SOC(361),
  "본머스": SOC(349),
  "브렌트포드": SOC(337),
  "노팅엄 포레스트": SOC(393),
  "울버햄튼": SOC(380),
  "에버턴": SOC(368),

  // EFL 챔피언십
  "렉섬": SOC(358),
  "버밍엄": SOC(375),
  "블랙번": SOC(365),
  "코번트리": SOC(388),
  "헐 시티": SOC(306),

  // 라리가
  "AT.마드리드": SOC(1068),
  "아틀레티코 마드리드": SOC(1068),
  "바르셀로나": SOC(83),
  "FC 바르셀로나": SOC(83),
  "세비야": SOC(243),
  "에스파뇰": SOC(88),
  "헤타페": SOC(2922),
  "레반테": SOC(1538),
  "라요 바예카노": SOC(101),
  "셀타 비고": SOC(85),
  "레알 베티스": SOC(244),
  "레알 소시에다드": SOC(89),

  // 세리에A
  "아탈란타": SOC(105),
  "유벤투스": SOC(111),
  "인터 밀란": SOC(110),
  "코모 1907": SOC(2572),
  "피오렌티나": SOC(109),
  "라치오": SOC(112),
  "볼로냐": SOC(107),
  "사수올로 칼초": SOC(3997),
  "우디네세 칼초": SOC(118),
  "칼리아리 칼초": SOC(2925),
  "파르마 칼초": SOC(115),
  "나폴리": SOC(114),
  "AS 로마": SOC(104),
  "AC 밀란": SOC(103),
  "헬라스 베로나": SOC(119),
  "피사": SOC(3956),
  "제노아": SOC(3263),

  // 분데스리가
  "바이에른 뮌헨": SOC(132),
  "장크트파울리": SOC(396),
  "도르트문트": SOC(124),
  "레버쿠젠": SOC(131),
  "베르더 브레멘": SOC(137),
  "볼프스부르크": SOC(138),
  "우니온 베를린": SOC(598),
  "아우크스부르크": SOC(3841),
  "쾰른": SOC(122),
  "호펜하임": SOC(7911),
  "마인츠": SOC(2950),
  "함부르크": SOC(127),
  "SC 프라이부르크": SOC(126),
  "프라이부르크": SOC(126),
  "프랑크푸르트": SOC(125),
  "라이프치히": SOC(11420),
  "하이덴하임": SOC(6418),
  "슈투트가르트": SOC(134),
  "묀헨글라트바흐": SOC(268),

  // 리그 1
  "로리앙": SOC(273),
  "리옹": SOC(166),
  "마르세유": SOC(176),
  "랑스": SOC(175),
  "툴루즈": SOC(179),
  "RC 스트라스부르": SOC(180),
  "스트라스부르": SOC(180),
  "릴": SOC(166),
  "니스": SOC(2502),
  "모나코": SOC(174),
  "오세르": SOC(172),
  "앙제": SOC(7868),
  "르 아브르": SOC(3236),
  "스타드 렌": SOC(169),
  "낭트": SOC(165),
  "브레스트": SOC(6997),
  "메스": SOC(177),
  "파리 FC": SOC(6851),
  "PSG": SOC(160),

  // UCL / UEL (clubs covered above; extras below)
  "레알 마드리드": SOC(86),
  "스포르팅 CP": SOC(498),
  "아스날": SOC(359),
  "파리 생제르망": SOC(160),
  "FC 포르투": SOC(437),
  "브라가": SOC(2994),
  "AZ 알크마르": SOC(140),
  "샤흐타르 도네츠크": SOC(493),
  "AEK 아테네": SOC(887),

  // MLS
  "LA 갤럭시": SOC(187),
  "스포팅 캔자스시티": SOC(186),
  "밴쿠버 화이트캡스 FC": SOC(9727),

  // LigaMX
  "톨루카": SOC(223),

  // UEFA Youth League (U19) - 모기업 로고 사용
  "벤피카 U19": SOC(1929),
  "클뤼프 브뤼헤 U19": SOC(570),
  "파리 생제르망 U19": SOC(160),
  "레알 마드리드 U19": SOC(86),

  // KBO
  "KIA": KBO_LOGO("HT"),
  "KT": KBO_LOGO("KT"),
  "LG": KBO_LOGO("LG"),
  "NC": KBO_LOGO("NC"),
  "SSG": KBO_LOGO("SK"),
  "두산": KBO_LOGO("OB"),
  "롯데": KBO_LOGO("LT"),
  "삼성": KBO_LOGO("SS"),
  "키움": KBO_LOGO("WO"),
  "한화": KBO_LOGO("HH"),

  // AFC
  "감바 오사카": SOC(6733),
  "방콕 유나이티드": SOC(18603),
  "알 사드": "https://www.thesportsdb.com/images/media/team/badge/908a011774579337.png",
  "알 와흐다": SOC(7059),
  "알 이티하드": SOC(2276),
  "알 힐랄": SOC(929),
  "마치다": SOC(22167),
  "고베": SOC(7477),
  "부리람": SOC(7138),
  "샤바브 알 아흘리": SOC(790),

  // K리그1
  "서울": "https://r2.thesportsdb.com/images/media/team/badge/31z1zf1579473186.png",
  "울산": "https://r2.thesportsdb.com/images/media/team/badge/0wooic1706533767.png",
  "대전": "https://r2.thesportsdb.com/images/media/team/badge/o9z6eq1589558557.png",
  "부천": "https://r2.thesportsdb.com/images/media/team/badge/mhcuwe1589557777.png",
  "인천": "https://r2.thesportsdb.com/images/media/team/badge/2no9nq1579473100.png",
  "제주": "https://r2.thesportsdb.com/images/media/team/badge/hna7ae1736207131.png",
  "김천": "https://r2.thesportsdb.com/images/media/team/badge/g4cjyk1609536787.png",
  "광주": "https://r2.thesportsdb.com/images/media/team/badge/uuzr4x1579473084.png",

  // KBL
  "원주 DB": "https://r2.thesportsdb.com/images/media/team/badge/ykuvm71742844633.png",
  "부산 KCC": "https://r2.thesportsdb.com/images/media/team/badge/9h9fqx1637980679.png",
  "고양 소노": "https://r2.thesportsdb.com/images/media/team/badge/l2qn7d1742844779.png",
  "서울 SK": "https://r2.thesportsdb.com/images/media/team/badge/qkd9sv1593415101.png",

  // WKBL (프로농구)
  "삼성생명 블루밍스": "https://www.wkbl.or.kr/static/images/team/teamlogo_03.png",
  "하나은행": "https://www.wkbl.or.kr/static/images/team/teamlogo_09.png",
};

export function getTeamLogo(name: string): string | null {
  return TEAM_LOGOS[name] ?? null;
}
