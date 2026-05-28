"use client";

import { useEffect, useState } from "react";
import data from "@/data/coupang-products.json";

export type CoupangProduct = {
  id: string;
  name: string;
  alt: string;
  shortLink: string;
  image: string;
  category: string;
};

export const ALL_PRODUCTS: CoupangProduct[] = data.products as CoupangProduct[];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 페이지 로드/리프레시마다 새로 셔플된 N개 반환.
 *  SSR 첫 페인트는 정적(처음 N개) → hydration 후 useEffect 에서 셔플로 교체.
 *  같은 카테고리 연속 노출을 줄이기 위해 카테고리 dedupe 옵션 제공.
 *  refreshKey 가 바뀌면 다시 셔플 (예: 페이지 전환 시). */
export function useShuffledProducts(
  count: number,
  opts: { dedupeCategory?: boolean; refreshKey?: string } = {},
): CoupangProduct[] {
  const { dedupeCategory = true, refreshKey } = opts;
  const [picks, setPicks] = useState<CoupangProduct[]>(() =>
    ALL_PRODUCTS.slice(0, count),
  );

  useEffect(() => {
    const shuffled = shuffle(ALL_PRODUCTS);
    if (!dedupeCategory) {
      setPicks(shuffled.slice(0, count));
      return;
    }
    // 같은 카테고리 우선 회피. 풀이 부족하면 중복 허용.
    const used = new Set<string>();
    const out: CoupangProduct[] = [];
    for (const p of shuffled) {
      if (used.has(p.category)) continue;
      out.push(p);
      used.add(p.category);
      if (out.length >= count) break;
    }
    // 카테고리 dedupe 후 부족하면 셔플된 나머지에서 채움.
    if (out.length < count) {
      for (const p of shuffled) {
        if (out.includes(p)) continue;
        out.push(p);
        if (out.length >= count) break;
      }
    }
    setPicks(out);
  }, [count, dedupeCategory, refreshKey]);

  return picks;
}
