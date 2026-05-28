"use client";

import type { CoupangProduct } from "./coupang-product-utils";

type Size = "xs" | "sm" | "md" | "lg";

/** 120x240 원본 비율(1:2) 유지하는 작은 광고 카드.
 *  size 별 표시 폭(높이는 자동 2배). Tailwind 클래스 inline 으로 박아
 *  카드 자체는 매우 단순한 a > img 구조. rel=sponsored 로 검색엔진에 광고 명시. */
const SIZE_MAP: Record<Size, { w: number; h: number; nameClass: string }> = {
  xs: { w: 60, h: 120, nameClass: "hidden" },
  sm: { w: 80, h: 160, nameClass: "hidden" },
  md: { w: 100, h: 200, nameClass: "text-[10px]" },
  lg: { w: 120, h: 240, nameClass: "text-[11px]" },
};

type Props = {
  product: CoupangProduct;
  size?: Size;
  showName?: boolean;
  className?: string;
};

export function CoupangProductCard({
  product,
  size = "lg",
  showName = false,
  className = "",
}: Props) {
  const { w, h, nameClass } = SIZE_MAP[size];
  return (
    <a
      href={product.shortLink}
      target="_blank"
      rel="nofollow sponsored noopener"
      referrerPolicy="unsafe-url"
      title={product.alt}
      className={`group block shrink-0 ${className}`}
      style={{ width: w }}
    >
      <div
        className="overflow-hidden rounded-lg bg-zinc-900/60 ring-1 ring-zinc-800/60 transition-transform group-hover:scale-[1.03] group-hover:ring-zinc-600"
        style={{ width: w, height: h }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.image}
          alt={product.alt}
          width={w}
          height={h}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      </div>
      {showName && (
        <p
          className={`mt-1 line-clamp-2 leading-tight text-zinc-400 ${nameClass}`}
        >
          {product.name}
        </p>
      )}
    </a>
  );
}

