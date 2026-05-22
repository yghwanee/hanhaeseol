"use client";

import { ReactNode, useLayoutEffect, useRef, useState } from "react";

type Pos = { left: number; top: number; width: number; height: number; ready: boolean };

/** 컨테이너 내부의 data-tab-key 요소를 찾아 컨테이너 기준 좌표를 측정. */
function useActiveRect(activeKey: string, depsKey: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<Pos>({ left: 0, top: 0, width: 0, height: 0, ready: false });

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const el = container.querySelector<HTMLElement>(
        `[data-tab-key="${CSS.escape(activeKey)}"]`,
      );
      if (!el) return;
      const cr = container.getBoundingClientRect();
      const er = el.getBoundingClientRect();
      setPos({
        left: er.left - cr.left + container.scrollLeft,
        top: er.top - cr.top + container.scrollTop,
        width: er.width,
        height: er.height,
        ready: true,
      });
    };

    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(container);
    container.querySelectorAll<HTMLElement>("[data-tab-key]").forEach((el) => ro.observe(el));
    container.addEventListener("scroll", measure);

    return () => {
      ro.disconnect();
      container.removeEventListener("scroll", measure);
    };
  }, [activeKey, depsKey]);

  return { containerRef, pos };
}

type SmoothTabsProps<T extends string> = {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  variant?: "filled" | "bordered";
  fullWidth?: boolean;
  gapClass?: string;
  className?: string;
  /** 버튼 위(세로 정렬)로 추가 요소 렌더링. 예: 요일 색상 점 */
  renderAbove?: (value: T) => ReactNode;
  ariaLabel?: string;
  /** 활성 pill 배경 클래스. 기본 "bg-zinc-100" */
  pillClassName?: string;
  /** bordered variant 의 활성 pill 보더 클래스. 기본은 pillClassName 과 동일 색. */
  pillBorderClassName?: string;
  /** 활성 텍스트 클래스. 기본 "text-zinc-900" */
  activeTextClassName?: string;
  /** 사이트 시그니처 btn-caps-stripe 효과 사용. 활성 = caps-stripe-pressed.
   *  슬라이딩 pill 대신 각 버튼에 직접 caps stripe sweep 효과 적용. 모바일에서도 효과 노출. */
  useCapsStripe?: boolean;
};

export function SmoothTabs<T extends string>({
  options,
  value,
  onChange,
  variant = "filled",
  fullWidth = false,
  gapClass,
  className = "",
  renderAbove,
  ariaLabel,
  pillClassName = "bg-zinc-100",
  pillBorderClassName,
  activeTextClassName = "text-zinc-900",
  useCapsStripe = false,
}: SmoothTabsProps<T>) {
  const depsKey = options.map((o) => o.value).join("|");
  const { containerRef, pos } = useActiveRect(value, depsKey);

  const gap = gapClass ?? "gap-1 sm:gap-1.5";
  // capsStripe(날짜 탭): 점이 박스 밖 sibling 으로 분리되어 박스는 텍스트만
  // 담음. 모바일은 py-1 으로 살짝 여유, 데스크탑은 py-0.5 로 컴팩트.
  const sizeCls = useCapsStripe
    ? "px-6 py-1 text-xs sm:px-4 sm:py-0.5 sm:text-sm"
    : "px-2.5 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm";
  const borderCls = pillBorderClassName ?? "border-zinc-100";

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`relative inline-flex ${fullWidth ? "w-full" : ""} ${gap} ${className}`}
    >
      {/* Sliding background — capsStripe 모드에서는 사용 안 함 (각 버튼이 직접 효과 처리). */}
      {!useCapsStripe && (
        <div
          aria-hidden
          className={`pointer-events-none absolute top-0 left-0 rounded-lg ${pillClassName} transition-[transform,width,height] duration-150 ease-out ${
            variant === "bordered" ? `border ${borderCls}` : ""
          }`}
          style={{
            transform: `translate3d(${pos.left}px, ${pos.top}px, 0)`,
            width: pos.width,
            height: pos.height,
            opacity: pos.ready ? 1 : 0,
          }}
        />
      )}
      {options.map((o) => {
        const active = o.value === value;
        // 베이스에 border-transparent를 깔아둬서 Tailwind preflight 기본값(연한 회색)이
        // transition-colors 도중에 잠깐 보이는 흰 잔상을 방지.
        const inactiveBorder =
          variant === "bordered"
            ? "border-zinc-700 hover:border-zinc-600"
            : "border-transparent";
        const baseShape = useCapsStripe
          ? "" // btn-caps-stripe 자체가 박스 모양/테두리 처리. rounded/border 없음.
          : "rounded-lg border border-transparent";
        const stateCls = useCapsStripe
          ? `btn-caps-stripe caps-stripe-tab${active ? " caps-stripe-pressed" : ""}`
          : active
            ? activeTextClassName
            : `text-zinc-400 hover:text-zinc-200 ${inactiveBorder}`;
        // renderAbove (점)는 박스 밖 sibling 으로 배치해 박스가 시각적으로
        // 짧아 보이게 함. 점은 4px 라서 그 자리만 클릭 사각지대 — 실용상
        // 무시할 만한 손실.
        const buttonInner = (
          <button
            type="button"
            data-tab-key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`relative z-10 shrink-0 whitespace-nowrap font-medium outline-none focus:outline-none ${
              useCapsStripe ? "" : "transition-colors "
            }${sizeCls} ${baseShape} ${stateCls} ${fullWidth ? "w-full" : ""}`}
          >
            {o.label}
          </button>
        );

        const withAbove = renderAbove ? (
          <div
            className={`${fullWidth ? "flex w-full" : "inline-flex"} flex-col items-center gap-1`}
          >
            {renderAbove(o.value)}
            {buttonInner}
          </div>
        ) : (
          buttonInner
        );

        if (fullWidth) {
          return (
            <div key={o.value} style={{ flex: "1 1 0%" }}>
              {withAbove}
            </div>
          );
        }

        return <div key={o.value} className="contents">{withAbove}</div>;
      })}
    </div>
  );
}

type SmoothCircleTabsProps<T extends string> = {
  options: T[];
  value: T;
  onChange: (value: T) => void;
  renderItem: (key: T, active: boolean) => ReactNode;
  itemWidth?: number;
  ringSize: number;
  className?: string;
  ariaLabel?: string;
};

/** 원형 아이콘 행. 활성 표시는 renderItem(key, active)에서 자체 처리(예: scale-105 + bg 색). */
export function SmoothCircleTabs<T extends string>({
  options,
  value,
  onChange,
  renderItem,
  itemWidth = 75,
  className = "",
  ariaLabel,
}: Omit<SmoothCircleTabsProps<T>, "ringSize"> & { ringSize?: number }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={`flex ${className}`}>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          data-tab-key={opt}
          role="tab"
          aria-selected={opt === value}
          onClick={() => onChange(opt)}
          className="shrink-0 outline-none focus:outline-none"
          style={{ width: itemWidth }}
        >
          {renderItem(opt, opt === value)}
        </button>
      ))}
      <div className="shrink-0 w-4" />
    </div>
  );
}
