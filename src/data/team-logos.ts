const MLB = (abbr: string) => `https://a.espncdn.com/i/teamlogos/mlb/500/${abbr}.png`;
const NBA = (abbr: string) => `https://a.espncdn.com/i/teamlogos/nba/500/${abbr}.png`;
const SOC = (id: number) => `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`;

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

  // NBA
  "LA 레이커스": NBA("lal"),
  "덴버": NBA("den"),
  "샌안토니오": NBA("sa"),
  "유타": NBA("utah"),

  // EPL
  "리버풀": SOC(364),
  "리즈": SOC(357),
  "맨시티": SOC(382),
  "맨유": SOC(360),
  "선덜랜드": SOC(366),
  "첼시": SOC(363),
  "토트넘": SOC(367),
  "풀럼": SOC(370),

  // EFL 챔피언십
  "렉섬": SOC(358),
  "버밍엄": SOC(375),

  // 라리가
  "AT.마드리드": SOC(1068),
  "아틀레티코 마드리드": SOC(1068),
  "바르셀로나": SOC(83),
  "FC 바르셀로나": SOC(83),
  "세비야": SOC(243),
  "에스파뇰": SOC(88),

  // 세리에A
  "아탈란타": SOC(105),
  "유벤투스": SOC(111),
  "인터 밀란": SOC(110),
  "코모 1907": SOC(2572),

  // 분데스리가
  "바이에른 뮌헨": SOC(132),
  "장크트파울리": SOC(396),

  // 리그 1
  "로리앙": SOC(273),
  "리옹": SOC(166),

  // UCL / UEL (clubs covered above; extras below)
  "레알 마드리드": SOC(86),
  "스포르팅 CP": SOC(498),
  "아스날": SOC(359),
  "파리 생제르망": SOC(160),

  // AFC
  "감바 오사카": SOC(6733),
  "방콕 유나이티드": SOC(18603),
  "알 와흐다": SOC(7059),
  "알 이티하드": SOC(2276),
  "알 힐랄": SOC(929),
};

export function getTeamLogo(name: string): string | null {
  return TEAM_LOGOS[name] ?? null;
}
