/**
 * MLS 30개 팀의 Eastern / Western Conference 매핑.
 * 네이버 API가 league 필드를 안 줄 때를 대비한 폴백.
 * 키: 네이버가 주는 한국어 팀명(standings.json의 teamName)
 */
export const MLS_CONFERENCE: Record<string, "EAST" | "WEST"> = {
  // Eastern Conference (15팀)
  "애틀란타 유나이티드": "EAST",
  "몬트리얼 임팩트": "EAST",
  "샬럿 FC": "EAST",
  "시카고 파이어": "EAST",
  "FC 신시내티": "EAST",
  "콜롬버스 크루": "EAST",
  "DC 유나이티드": "EAST",
  "인터 마이애미": "EAST",
  "내쉬빌 SC": "EAST",
  "뉴잉글랜드 레볼루션": "EAST",
  "뉴욕 시티 FC": "EAST",
  "뉴욕 레드 불스": "EAST",
  "올랜도 시티": "EAST",
  "필라델피아 유니언": "EAST",
  "토론토 FC": "EAST",

  // Western Conference (15팀)
  "오스틴 FC": "WEST",
  "콜로라도 라피즈": "WEST",
  "FC 댈러스": "WEST",
  "휴스턴 디나모": "WEST",
  "LA 갤럭시": "WEST",
  "로스앤젤레스 FC": "WEST",
  "미네소타 유나이티드": "WEST",
  "포틀랜드 팀버스": "WEST",
  "리얼 솔트 레이크": "WEST",
  "샌디에고 FC": "WEST",
  "SJ 어스퀘이크": "WEST",
  "시애틀 사운더스": "WEST",
  "스포팅 KC": "WEST",
  "세인트루이스 시티": "WEST",
  "밴쿠버 화이트캡스": "WEST",
};
