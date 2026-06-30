// IntroAnimation 에서 사용하는 엠블럼 경로 목록.
// 서버 컴포넌트(layout.tsx)에서 <link rel="preload"> 로 선로딩하기 위해
// "use client" 가 없는 별도 모듈로 분리.
export const INTRO_COL_A = [
  "/logos/naver-football/1006.webp",
  "/logos/kbo/HT.webp",
  "/logos/naver-football/12.webp",
  "/logos/kbo/LG.webp",
  "/logos/naver-football/9.webp",
  "/logos/kbo/SS.webp",
  "/logos/naver-football/4.webp",
];

export const INTRO_COL_B = [
  "/logos/naver-football/11.webp",
  "/logos/kbo/KT.webp",
  "/logos/naver-football/2.webp",
  "/logos/kbo/NC.webp",
  "/logos/naver-football/31.webp",
  "/logos/kbo/LT.webp",
  "/logos/naver-football/8.webp",
];

export const INTRO_COL_C = [
  "/logos/naver-football/23.webp",
  "/logos/kbo/SK.webp",
  "/logos/naver-football/48.webp",
  "/logos/kbo/HH.webp",
  "/logos/naver-football/6795.webp",
  "/logos/kbo/OB.webp",
  "/logos/kbo/WO.webp",
];

export const INTRO_EMBLEM_PATHS = [...INTRO_COL_A, ...INTRO_COL_B, ...INTRO_COL_C];
