"use client";

import { useEffect, useRef, useState } from "react";
import { useAdsReady } from "./ads-ready";

/**
 * 카카오 애드핏 배너.
 *
 * PC / 모바일 광고단위를 **따로** 등록했으므로 하나만 골라 띄운다.
 *
 * 🔴 CSS 로 둘 다 렌더하고 미디어쿼리로 감추면 안 된다. 감춰진 쪽도 스크립트가 로드되어
 * **노출(impression)이 집계되는데 실제로는 아무도 보지 못한다.** 광고주 입장에서 무효 노출이고
 * 애드핏 운영정책이 경계하는 형태다. 그래서 마운트 시점에 뷰포트를 보고 한쪽만 렌더한다.
 *
 * 서버에서는 뷰포트를 알 수 없으므로 SSR 출력에는 아무것도 없고 하이드레이션 후에 붙는다.
 * 광고는 어차피 클라이언트에서만 뜨므로 SEO 영향이 없다(본문이 아니다).
 *
 * **리사이즈에 반응하지 않는다.** 브레이크포인트를 넘나들 때마다 다시 마운트하면 그때마다
 * 노출이 새로 잡혀 숫자가 부풀려진다. 세션 중 화면 폭이 바뀌는 건 드문 경우라 마운트 시점의
 * 판정을 유지한다.
 */

type Variant = { unit: string; width: number; height: number };

/**
 * 슬롯별 광고단위. 애드핏은 **같은 `data-ad-unit` 을 한 페이지에 두 번 두면 거부**하므로
 * (SDK: "광고 data-ad-unit 은 유일한 값이어야 합니다", 페이지당 최대 4개) 홈 상단과
 * 홈 인라인은 서로 다른 단위를 쓴다.
 */
const SLOTS = {
  /** 고지 문구 아래 · 날짜 탭 위. PC 728x90 / 모바일 320x50. */
  top: {
    pc: { unit: "DAN-STkkoddKPkuh5cwy", width: 728, height: 90 },
    mobile: { unit: "DAN-sevERV2qTEmuNFC7", width: 320, height: 50 },
    // PC 광고(728)가 본문 컬럼보다 넓다. `max-w-2xl` 은 border-box 라 `px-4` 를 뺀
    // **실제 콘텐츠 폭이 640px**이고, 그대로 두면 광고가 눌린다(실측 704px).
    // PC 구간만 `-mx-12`(양쪽 48px)로 컬럼을 벗어나 640 + 96 = 736 ≥ 728 을 확보한다.
    // 모바일에 negative margin 을 주면 화면 폭을 넘겨 가로 스크롤이 생기므로 PC 한정.
    //
    // `min-h` 는 자리 선점이다. 편성표 상단이라 광고가 채워질 때 본문을 밀면 CLS 를
    // 그대로 깎는다. **컨테이너 높이만** 미디어쿼리이고 광고 ins 는 여전히 한쪽만 렌더한다.
    wrapper: "min-h-[50px] min-[800px]:-mx-12 min-[800px]:min-h-[90px]",
  },
  /** 홈 편성표 "오후 경기" 구분선 아래. PC 728x90 / 모바일 300x250.
   *
   *  🔴 이 크기는 **애드핏 대시보드의 광고단위 유형과 반드시 일치해야 한다.** SDK 는
   *  `data-ad-width/height` 로 소재를 요청하므로 어긋나면 채워지지 않는다. 대시보드에서
   *  규격을 바꿨으면 여기도 같이 바꿔야 한다(2026-07-30: PC 인라인을 300x250 → 728x90 으로
   *  변경했고, 모바일 인라인은 300x250 그대로다). */
  inline: {
    pc: { unit: "DAN-lcALm7uz8M1Y77F7", width: 728, height: 90 },
    mobile: { unit: "DAN-kJ3thvrkQ3G6WyUG", width: 300, height: 250 },
    // PC 728 은 본문 컬럼(실효 640)보다 넓어 상단 슬롯과 같은 breakout 이 필요하다
    // (640 + 96 = 736 ≥ 728). 모바일에 negative margin 을 주면 화면 폭을 넘겨 가로
    // 스크롤이 생기므로 PC 한정이다.
    //
    // `min-h` 는 자리 선점(CLS). 경기 카드 사이라 채워질 때 아래 카드가 밀리면 안 된다.
    // 모바일 300x250 → 250, PC 728x90 → 90 으로 규격별 높이를 잡는다.
    wrapper: "min-h-[250px] min-[800px]:-mx-12 min-[800px]:min-h-[90px]",
  },
  /** 좌우 고정 사이드(XL≥1280px) 우측 자리. PC 전용 160x600, 모바일 단위 없음.
   *  `minWidth` 를 xl 브레이크포인트(1280)에 맞춰야 한다 — 기본 800 을 쓰면 800~1279px
   *  구간에서 부모 aside 는 `hidden`(비표시)인데 이 컴포넌트는 "PC 폭이다" 판단해 `<ins>`
   *  를 그대로 그려 SDK 가 스캔한다. 화면엔 안 보이는데 노출만 잡히는, 이 파일이 경계하는
   *  바로 그 무효노출 패턴. `mobile` 이 없으므로 1280 미만에서는 아예 `<ins>` 를 그리지 않는다. */
  sideRight: {
    pc: { unit: "DAN-CF8kPxnkszA1dow9", width: 160, height: 600 },
    mobile: null,
    wrapper: "min-h-[600px]",
    minWidth: 1280,
  },
} as const;

export type AdfitSlot = keyof typeof SLOTS;

/** PC 단위로 갈아타는 최소 폭.
 *
 * 처음엔 768(= Tailwind `md`)로 잡았는데 계산해 보니 부족했다. 컨테이너 좌우 패딩이
 * 16px씩이라 728 배너에 필요한 폭이 **728 + 32 = 760px**이고, 데스크톱 브라우저는 세로
 * 스크롤바로 15~17px 을 더 먹는다. 768px 창에서는 가용폭이 ~753px 이라 7px 넘친다
 * (Playwright 기본 뷰포트에는 스크롤바가 없어서 이 조건이 테스트에서 안 잡혔다).
 * 800 이면 스크롤바까지 감안해도 여유가 있다. 768~799 구간(태블릿 세로)은 모바일 배너를
 * 쓰는데, 그쪽이 그 폭에서 더 자연스럽기도 하다.
 *
 * 인라인 슬롯은 300x250 이라 이 폭이 필요 없지만, 등록된 단위가 PC/모바일로 나뉘어 있어
 * 같은 기준으로 고른다. */
const PC_MIN_WIDTH = 800;

const SDK_SRC = "//t1.kakaocdn.net/kas/static/ba.min.js";

/* ─────────────────────────────────────────────────────────────────────────────
 *  SDK 는 **페이지당 한 번만** 붙인다.
 *
 *  SDK 는 `document.body.querySelectorAll("ins.kakao_ad_area")` 로 문서 전체를 훑는다
 *  (2026-07-30 ba.min.js 확인). 배너마다 스크립트를 붙이면 스캔이 그 횟수만큼 돌고,
 *  이미 채워진 단위를 다시 렌더하면 **중복 노출**이 된다. 무효 노출은 정책 위반 축이라
 *  피해야 한다. 그래서 첫 배너만 붙이고 나머지는 그 스캔에 얹힌다 — ins 는 스크립트보다
 *  먼저 DOM 에 들어간다(각 인스턴스가 variant 상태를 세팅한 뒤 두 번째 effect 에서
 *  스크립트를 붙이므로 같은 커밋의 ins 는 전부 존재한다).
 * ──────────────────────────────────────────────────────────────────────────── */
let sdkScript: HTMLScriptElement | null = null;
let mountedCount = 0;

function appendSdk() {
  const script = document.createElement("script");
  script.type = "text/javascript";
  script.src = SDK_SRC;
  script.async = true;
  document.head.appendChild(script);
  sdkScript = script;
}

/** 페이지에 이미 채워진 광고가 있는지. 있으면 재삽입(=재스캔)하지 않는다. */
function hasFilledAd() {
  return Array.from(document.querySelectorAll("ins.kakao_ad_area")).some(
    (el) => el.childElementCount > 0,
  );
}

export function AdfitBanner({
  className = "",
  slot = "top",
}: {
  className?: string;
  slot?: AdfitSlot;
}) {
  const config = SLOTS[slot];
  const [variant, setVariant] = useState<Variant | null>(null);
  const insRef = useRef<HTMLModElement>(null);
  // 🔴 페이지의 모든 슬롯이 같은 신호로 함께 마운트돼야 한다. SDK 스캔이 한 번뿐이라
  // 슬롯마다 마운트 시점이 다르면 늦은 슬롯이 영구히 빈칸으로 남는다(ads-ready.ts 참고).
  const adsReady = useAdsReady();

  useEffect(() => {
    if (!adsReady) return;
    const threshold = "minWidth" in config ? config.minWidth : PC_MIN_WIDTH;
    if (window.innerWidth >= threshold) {
      setVariant(config.pc);
    } else {
      setVariant(config.mobile);
    }
  }, [config, adsReady]);

  useEffect(() => {
    // ins 가 DOM 에 들어간 뒤에 SDK 를 붙여야 스캔 대상이 된다.
    if (!variant || !insRef.current) return;

    mountedCount += 1;
    if (!sdkScript) appendSdk();

    // 클라이언트 라우팅 대비. 새 페이지의 배너가 이전 페이지 배너보다 먼저 마운트되면
    // 스크립트가 이미 있어 재스캔이 안 돌고 이 ins 가 빈 채로 남을 수 있다. 그때만
    // 다시 붙인다 — **채워진 광고가 하나도 없을 때로 한정**해서 중복 노출을 만들지 않는다.
    const rescan = window.setTimeout(() => {
      const el = insRef.current;
      if (!el || el.childElementCount > 0) return;
      if (hasFilledAd()) return;
      sdkScript?.remove();
      appendSdk();
    }, 2500);

    return () => {
      window.clearTimeout(rescan);
      mountedCount -= 1;
      // 마지막 배너가 사라질 때만 스크립트를 걷는다. 다시 들어올 때 새로 붙어야
      // 그때 마운트된 ins 를 SDK 가 잡는다(스크립트가 남아 있으면 재실행되지 않는다).
      if (mountedCount <= 0) {
        mountedCount = 0;
        sdkScript?.remove();
        sdkScript = null;
      }
    };
  }, [variant]);

  return (
    // 채워지지 않으면 ins 가 display:none 인 채로 남아 아무것도 보이지 않는다
    // (대체 광고 미설정이라 흰 박스가 뜨지 않는다 — 다크 테마에 유리).
    <div className={`flex justify-center ${config.wrapper} ${className}`}>
      {variant && (
        <ins
          ref={insRef}
          // flex item 은 기본이 shrink 1 이라 컨테이너가 좁으면 광고가 눌린다.
          className="kakao_ad_area shrink-0"
          style={{ display: "none" }}
          data-ad-unit={variant.unit}
          data-ad-width={String(variant.width)}
          data-ad-height={String(variant.height)}
        />
      )}
    </div>
  );
}
