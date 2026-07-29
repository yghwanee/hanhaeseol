"use client";

import { useEffect, useRef, useState } from "react";

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

const PC = { unit: "DAN-STkkoddKPkuh5cwy", width: 728, height: 90 } as const;
const MOBILE = { unit: "DAN-sevERV2qTEmuNFC7", width: 320, height: 50 } as const;

/**
 * PC 단위로 갈아타는 최소 폭.
 *
 * 광고가 728px 인데 본문 컬럼은 `max-w-2xl`(672px)이다. 좁은 화면에서 PC 배너를 쓰면
 * 가로 스크롤이 생긴다.
 *
 * 처음엔 768(= Tailwind `md`)로 잡았는데 계산해 보니 부족했다. 컨테이너 좌우 패딩이
 * 16px씩이라 실제 필요 폭이 **728 + 32 = 760px**이고, 데스크톱 브라우저는 세로 스크롤바로
 * 15~17px 을 더 먹는다. 768px 창에서는 가용폭이 ~753px 이라 7px 넘친다
 * (Playwright 기본 뷰포트에는 스크롤바가 없어서 이 조건이 테스트에서 안 잡혔다).
 * 800 이면 스크롤바까지 감안해도 여유가 있다. 768~799 구간(태블릿 세로)은 모바일 배너를
 * 쓰는데, 그쪽이 그 폭에서 더 자연스럽기도 하다.
 */
const PC_MIN_WIDTH = 800;

const SDK_SRC = "//t1.kakaocdn.net/kas/static/ba.min.js";

export function AdfitBanner({ className = "" }: { className?: string }) {
  const [variant, setVariant] = useState<typeof PC | typeof MOBILE | null>(null);
  const insRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    setVariant(window.innerWidth >= PC_MIN_WIDTH ? PC : MOBILE);
  }, []);

  useEffect(() => {
    // ins 가 DOM 에 들어간 뒤에 SDK 를 붙여야 스캔 대상이 된다.
    if (!variant || !insRef.current) return;

    // SDK 는 document 전체에서 `ins.kakao_ad_area` 를 찾으므로 위치는 무관하다.
    // React 가 관리하는 트리 안에 raw DOM 노드를 끼우면 재조정과 충돌할 수 있어 head 에 붙인다.
    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = SDK_SRC;
    script.async = true;
    document.head.appendChild(script);

    // 클라이언트 라우팅으로 페이지를 벗어나면 제거한다. 다시 들어올 때 새로 붙어야
    // 그때 마운트된 ins 를 SDK 가 다시 잡는다(스크립트가 남아 있으면 재실행되지 않는다).
    return () => {
      script.remove();
    };
  }, [variant]);

  return (
    // 본문 컬럼(max-w-2xl = 672px)보다 광고가 넓어서 컨테이너를 따로 둔다.
    // 채워지지 않으면 ins 가 display:none 인 채로 남아 아무것도 보이지 않는다
    // (대체 광고 미설정이라 흰 박스가 뜨지 않는다 — 다크 테마에 유리).
    <div className={`flex w-full justify-center px-3 sm:px-4 ${className}`}>
      {variant && (
        <ins
          ref={insRef}
          className="kakao_ad_area"
          style={{ display: "none" }}
          data-ad-unit={variant.unit}
          data-ad-width={String(variant.width)}
          data-ad-height={String(variant.height)}
        />
      )}
    </div>
  );
}
