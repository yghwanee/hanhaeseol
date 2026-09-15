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
        /* Wanted(몽타주) 시맨틱 토큰 — 값은 globals.css 의 :root 에 있다.
           🔴 컴포넌트에서 zinc 계열이나 white 를 직접 쓰지 말고 여기 이름을 쓸 것.
           그래야 라이트/다크 전환이 토큰 한 곳에서 끝난다. */
        canvas: "var(--w-canvas)",
        surface: "var(--w-surface)",
        subtle: "var(--w-subtle)",
        muted: "var(--w-muted)",
        elevated: "var(--w-elevated)",   /* 모달·팝오버 전용 면 */
        inverse: "var(--w-inverse)",
        brand: {
          DEFAULT: "var(--w-brand)",
          hover: "var(--w-brand-hover)",
          subtle: "var(--w-brand-subtle)",
        },
        fg: {
          strong: "var(--w-fg-strong)",
          DEFAULT: "var(--w-fg)",
          secondary: "var(--w-fg-secondary)",
          tertiary: "var(--w-fg-tertiary)",
          disabled: "var(--w-fg-disabled)",
          onbrand: "var(--w-fg-on-brand)",
          brand: "var(--w-brand-fg)",
          "brand-bright": "var(--w-brand-fg-bright)",
          success: "var(--w-success)",
          danger: "var(--w-danger)",
          warning: "var(--w-warning)",
        },
        line: {
          subtle: "var(--w-line-subtle)",
          DEFAULT: "var(--w-line)",
          strong: "var(--w-line-strong)",
        },
      },
      /* 원티드 타입 램프. 시그너처 둘 — 18px 이상은 네거티브 트래킹,
         Body 이하는 0~양수 트래킹(작은 글씨 가독성 보존). */
      fontSize: {
        display3: ["36px", { lineHeight: "1.334", letterSpacing: "-0.027em", fontWeight: "700" }],
        title2: ["28px", { lineHeight: "1.358", letterSpacing: "-0.0236em", fontWeight: "700" }],
        title3: ["24px", { lineHeight: "1.334", letterSpacing: "-0.023em", fontWeight: "700" }],
        heading1: ["22px", { lineHeight: "1.364", letterSpacing: "-0.0194em", fontWeight: "700" }],
        heading2: ["20px", { lineHeight: "1.4", letterSpacing: "-0.012em", fontWeight: "700" }],
        headline1: ["18px", { lineHeight: "1.445", letterSpacing: "-0.002em", fontWeight: "600" }],
        headline2: ["17px", { lineHeight: "1.412", letterSpacing: "0em", fontWeight: "600" }],
        body1: ["16px", { lineHeight: "1.5", letterSpacing: "0.0057em" }],
        "body1-read": ["16px", { lineHeight: "1.625", letterSpacing: "0.0057em" }],
        body2: ["15px", { lineHeight: "1.467", letterSpacing: "0.0096em" }],
        label1: ["14px", { lineHeight: "1.429", letterSpacing: "0.0145em" }],
        label2: ["13px", { lineHeight: "1.385", letterSpacing: "0.0194em" }],
        caption1: ["12px", { lineHeight: "1.334", letterSpacing: "0.0252em" }],
        caption2: ["11px", { lineHeight: "1.273", letterSpacing: "0.0311em" }],
      },
    },
  },
  plugins: [typography],
};
export default config;
