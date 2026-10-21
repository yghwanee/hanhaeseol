"use client";

import { useState } from "react";
import { proxyLogo } from "@/lib/emblem";

export function TeamLogo({ name, src, size = 64 }: { name: string; src: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);

  // src 없거나 외부 이미지 로드 실패 시: 팀 이름 첫 글자 배지.
  // 🔴 예전엔 한해설 로고(/icon.png)를 띄웠는데, 배구 전 팀·KBL 일부처럼 엠블럼 출처가 없는
  // 팀마다 사이트 로고가 팀 로고 자리에 박혀 "이미지가 깨졌다"로 읽혔다(2026-10-22 화니 지적).
  if (!src || failed) {
    const initial = Array.from(name.replace(/^(FC|AFC|AC|AS|RB|SC)\s+/i, "").trim())[0] ?? "?";
    return (
      <div
        className="flex shrink-0 items-center justify-center rounded-full border border-line bg-muted font-semibold text-fg-secondary"
        style={{ width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.42)) }}
        role="img"
        aria-label={name}
      >
        {initial}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={proxyLogo(src)}
      alt={name}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      referrerPolicy="no-referrer"
      className="object-contain"
      style={{ width: size, height: size }}
    />
  );
}
