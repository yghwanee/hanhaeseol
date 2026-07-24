"use client";

import Image from "next/image";

/**
 * 채운(chaeun.haeseol.com) 자매 프로젝트 프로모 — 한해설 메인 좌측 사이드(XL≥1280px).
 * 쿠팡 우측 aside(120x240 카드 2개, 총 ~492px) 자리를 세로 배너로 대체.
 *
 * 상단 락업(인장 + 채운)은 채운 사이트의 .brand / .brand-seal 을 그대로 옮김 —
 * 주홍(#b23a2e) 낙관에 흰 彩運 세로 스택, 흰 안쪽 테두리, -5도 기울임, Noto Serif KR.
 * 연꽃은 세로 크롭(chaeun-flower.jpg)을 확대 없이(contain) 아래에 크게 깔고, 위쪽은
 * 사진의 어두운 하늘이 박스 잉크(#0b0b0c)로 자연스럽게 이어지도록 그라데이션으로 잇는다.
 * CTA(내 기운 보기)는 연꽃 아래 바위 위라 꽃송이를 가리지 않는다.
 */
const SERIF = "var(--font-serif-kr),'Noto Serif KR',Georgia,serif";
const INK = "#0b0b0c";
const GOLD = "#c9945a"; // 채운 --gold-lit
const SEAL = "#b23a2e"; // 채운 --seal
const PAPER = "#f4eee1"; // 채운 --paper

export function ChaeunSideBanner() {
  return (
    <a
      href="https://chaeun.haeseol.com"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="채운 — 오행으로 채우는 나만의 배경화면 (새 창)"
      title="채운 彩運 — 빛나는 운을 채우다"
      className="group block shrink-0"
      style={{ width: 124 }}
    >
      <div
        className="relative flex flex-col overflow-hidden rounded-xl ring-1 ring-[rgba(201,148,90,0.3)] transition-transform duration-200 group-hover:scale-[1.02] group-hover:ring-[rgba(201,148,90,0.55)]"
        style={{ width: 124, height: 500, backgroundColor: INK, fontFamily: SERIF }}
      >
        {/* 연꽃 — 확대 금지(contain). 세로 크롭을 아래에 크게 깐다. */}
        <Image
          src="/chaeun-flower.jpg"
          alt=""
          aria-hidden
          fill
          sizes="124px"
          className="object-contain transition-transform duration-700 ease-out"
          style={{ objectPosition: "center bottom" }}
        />
        {/* 꽃에서 위로 은은히 번지는 색 — 잉크와 자연스럽게 잇는다. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 130% 34% at 50% 74%, rgba(150,110,190,0.2), transparent 70%)",
          }}
        />
        {/* seam 블렌드 — 연꽃 위쪽(어두운 하늘)을 잉크로 덮어 통짜처럼 잇고, 글자 가독성 확보. */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              `linear-gradient(to top, transparent 0%, transparent 44%, rgba(11,11,12,0.5) 49%, ${INK} 55%, ${INK} 100%)`,
          }}
        />

        {/* ── 상단 락업: 채운 + 인장 (채운 .brand / .brand-seal 이식) ── */}
        <div className="relative z-10 flex flex-col items-center px-3 pt-4">
          <div className="flex items-center gap-2">
            <span
              className="font-black leading-none"
              style={{ color: PAPER, fontSize: 27, letterSpacing: "-0.03em", textShadow: "0 2px 14px rgba(0,0,0,0.7)" }}
            >
              채운
            </span>
            {/* 인장 — 주홍 낙관, 흰 彩運, 흰 안쪽 테두리, -5도 */}
            <span
              aria-hidden
              className="flex flex-col items-center justify-center font-bold leading-[1.02]"
              style={{
                backgroundColor: SEAL,
                color: "#fff",
                fontSize: 10.5,
                padding: "4px 4px",
                borderRadius: 5,
                transform: "rotate(-5deg)",
                boxShadow: "inset 0 0 0 1.5px rgba(255,255,255,0.38)",
              }}
            >
              <span>彩</span>
              <span>運</span>
            </span>
          </div>
          {/* 골드 헤어라인 */}
          <span
            aria-hidden
            className="mt-2.5 block"
            style={{
              width: 46,
              height: 1,
              background: `linear-gradient(to right, transparent, ${GOLD}, transparent)`,
            }}
          />
        </div>

        {/* ── 세로쓰기 태그라인 (좌→우: vertical-lr, 2열) ── */}
        <div className="relative z-10 flex flex-1 items-start justify-center px-2 pt-4">
          <p
            className="m-0 h-[186px] text-center"
            style={{
              writingMode: "vertical-lr",
              textOrientation: "upright",
              color: PAPER,
              fontSize: 13.5,
              lineHeight: 1.95,
              letterSpacing: "0.08em",
              textShadow: "0 1px 10px rgba(0,0,0,0.9)",
              wordBreak: "keep-all",
            }}
          >
            오행으로 채우는
            <br />
            나만의 배경화면
          </p>
        </div>

        {/* ── CTA (연꽃 아래 바위 위) ── */}
        <div className="relative z-10 px-3 pb-4">
          <span
            className="flex items-center justify-center gap-1 whitespace-nowrap rounded-full py-1.5 text-[11.5px] font-semibold transition-transform duration-150 group-hover:scale-[1.04]"
            style={{
              color: INK,
              backgroundColor: GOLD,
              letterSpacing: "0.02em",
              boxShadow: "0 2px 14px rgba(0,0,0,0.6)",
            }}
          >
            내 기운 보기
            <span aria-hidden>→</span>
          </span>
        </div>
      </div>
    </a>
  );
}
