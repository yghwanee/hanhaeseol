// IntroAnimation 에서 사용하는 엠블럼 경로 목록.
// 서버 컴포넌트(layout.tsx)에서 <link rel="preload"> 로 선로딩하기 위해
// "use client" 가 없는 별도 모듈로 분리.
export const INTRO_COL_A = [
  "/logos/naver-football/1006.png",
  "/logos/kbo/HT.png",
  "/logos/naver-football/12.png",
  "/logos/kbo/LG.png",
  "/logos/naver-football/9.png",
  "/logos/kbo/SS.png",
  "/logos/naver-football/4.png",
];

export const INTRO_COL_B = [
  "/logos/naver-football/11.png",
  "/logos/kbo/KT.png",
  "/logos/naver-football/2.png",
  "/logos/kbo/NC.png",
  "/logos/naver-football/31.png",
  "/logos/kbo/LT.png",
  "/logos/naver-football/8.png",
];

export const INTRO_COL_C = [
  "/logos/naver-football/23.png",
  "/logos/kbo/SK.png",
  "/logos/naver-football/48.png",
  "/logos/kbo/HH.png",
  "/logos/naver-football/6795.png",
  "/logos/kbo/OB.png",
  "/logos/kbo/WO.png",
];

export const INTRO_EMBLEM_PATHS = [...INTRO_COL_A, ...INTRO_COL_B, ...INTRO_COL_C];
