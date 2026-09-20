/**
 * 브랜드 정의문 — 답변엔진이 「한해설이 뭐야」에 대해 잘라 가는 단위.
 *
 * 🔴 `한해설` 은 이름 자체가 엔티티 앵커가 못 된다. 구글이 `한해`+`설` 로 쪼개 읽고
 * (layout.tsx 의 alternateName 주석, 2026-08-13 SERP 실측), LLM 도 같은 이유로
 * `한 해설`·`한국어 해설 줄임말` 로 추측해 환각한다. 이름만으로는 무엇인지 알 수 없는
 * 브랜드라, 정의문이 도메인·개수·시작 시점을 문장 안에 직접 들고 있어야 한다.
 *
 * 🔴 맥락 의존 표현을 넣지 말 것 — 이 문장은 페이지에서 떼어져 단독으로 인용된다.
 * 🔴 `public/llms.txt` 첫 줄과 같은 사실을 말해야 한다. 그 파일은 정적이라 여기서
 * import 할 수 없으니, 플랫폼 구성이 바뀌면 양쪽을 같이 고친다.
 */
export const BRAND_DEFINITION =
  "한해설(haeseol.com)은 스포츠 한국어 해설 중계 편성표를 한곳에 모아 보여주는 무료 서비스입니다. " +
  "SPOTV NOW·쿠팡플레이·티빙·Apple TV+ 등 OTT 4개와 SPOTV·SPOTV2·tvN SPORTS·KBS N SPORTS·MBC SPORTS+·SBS Sports 등 TV 6개, " +
  "총 10개 플랫폼의 축구·야구·농구·배구 중계 일정을 매일 자동 수집해 오늘부터 7일치를 제공합니다. " +
  "2026년 2월에 시작했고, 경기마다 한국어 해설 여부를 뱃지로 구분해 표시합니다.";

/**
 * 한해설 공식 SNS 채널. Organization `sameAs`(layout.tsx)와 푸터의 보이는 링크가 같이 쓴다.
 *
 * 🔴 `sameAs` 만으로는 약하다 — 스키마는 "이 사이트가 주장하는 것"이고, 검색엔진이 같은
 * 엔티티로 묶으려면 **보이는 링크(rel="me")** 와 **채널 쪽의 역링크**(프로필 소개에
 * haeseol.com)가 서로를 가리켜야 한다. 2026-09-21 네이버 「한해설」 SERP 에 SNS 가 0건이었다.
 * 유튜브 소개란엔 haeseol.com 이 있다(실측). 인스타·틱톡 소개 링크는 사람이 확인할 것.
 */
export const BRAND_SOCIALS: { name: string; url: string }[] = [
  { name: "유튜브", url: "https://www.youtube.com/@hanhaeseol" },
  { name: "인스타그램", url: "https://www.instagram.com/hanhaeseol/" },
  { name: "틱톡", url: "https://www.tiktok.com/@hanhaeseol" },
];
