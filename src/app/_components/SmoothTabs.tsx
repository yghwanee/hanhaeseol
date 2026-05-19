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
}: SmoothTabsProps<T>) {
  const depsKey = options.map((o) => o.value).join("|");
  const { containerRef, pos } = useActiveRect(value, depsKey);

  const gap = gapClass ?? "gap-1 sm:gap-1.5";
  const sizeCls = "px-2.5 py-1 text-xs sm:px-3 sm:py-1.5 sm:text-sm";

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label={ariaLabel}
      className={`relative inline-flex ${fullWidth ? "w-full" : ""} ${gap} ${className}`}
    >
      {/* Sliding background */}
      <div
        aria-hidden
        className={`pointer-events-none absolute top-0 left-0 rounded-lg bg-zinc-100 transition-[transform,width,height] duration-300 ease-out ${
          variant === "bordered" ? "border border-zinc-100" : ""
        }`}
        style={{
          transform: `translate3d(${pos.left}px, ${pos.top}px, 0)`,
          width: pos.width,
          height: pos.height,
          opacity: pos.ready ? 1 : 0,
        }}
      />
      {options.map((o) => {
        const active = o.value === value;
        // 베이스에 border-transparent를 깔아둬서 Tailwind preflight 기본값(연한 회색)이
        // transition-colors 도중에 잠깐 보이는 흰 잔상을 방지.
        const inactiveBorder =
          variant === "bordered"
            ? "border-zinc-700 hover:border-zinc-600"
            : "border-transparent";
        const buttonInner = (
          <button
            type="button"
            data-tab-key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`relative z-10 shrink-0 whitespace-nowrap rounded-lg border border-transparent font-medium outline-none transition-colors focus:outline-none ${sizeCls} ${
              active ? "text-zinc-900" : `text-zinc-400 hover:text-zinc-200 ${inactiveBorder}`
            } ${fullWidth ? "w-full" : ""}`}
          >
            {o.label}
          </button>
        );

        if (renderAbove) {
          return (
            <div
              key={o.value}
              className="flex shrink-0 flex-col items-center gap-1.5 sm:gap-2"
              style={fullWidth ? { flex: "1 1 0%" } : undefined}
            >
              {renderAbove(o.value)}
              {buttonInner}
            </div>
          );
        }

        if (fullWidth) {
          return (
            <div key={o.value} style={{ flex: "1 1 0%" }}>
              {buttonInner}
            </div>
          );
        }

        return <div key={o.value} className="contents">{buttonInner}</div>;
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
