import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      /**
       * 🔴 mono 스택 끝에 본문 한글 폰트를 붙인다 — **안전망**이다.
       *
       * Tailwind 기본 mono(Consolas·Menlo·Courier…)엔 한글 글리프가 하나도 없다. 그래서
       * `font-mono` 가 걸린 자리에 한글이 섞이면 브라우저가 아무 시스템 폰트나 골라
       * 한 문자열 안에서 두 폰트로 갈린다(2026-09-03 "9월 4일 (금) 18:15" 실측).
       *
       * 원칙은 **한글이 나올 수 있는 곳에 `font-mono` 를 쓰지 않는 것**이고(`tabular-nums`
       * 로 대체), 이 폴백은 놓친 자리가 최소한 본문과 같은 폰트로 떨어지게 하는 보험이다.
       */
      fontFamily: {
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "var(--font-pretendard-ui)",
          "Apple SD Gothic Neo",
          "Malgun Gothic",
          "monospace",
        ],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [typography],
};
export default config;
