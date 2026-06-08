"use client";

import { useState } from "react";
import { proxyLogo } from "@/lib/emblem";

export function TeamLogo({ name, src, size = 64 }: { name: string; src: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);

  // src 없거나 외부 이미지 로드 실패 시: 한해설 로고로 폴백 (initials placeholder 대신).
  // 실제 팀 로고와 시각적으로 구분되도록 컨테이너 크기 안에서 2/3로 축소 + opacity-60 톤다운.
  if (!src || failed) {
    const inner = Math.round((size * 2) / 3);
    return (
      <div
        className="flex items-center justify-center"
        style={{ width: size, height: size }}
        aria-label={name}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon.png"
          alt={name}
          width={inner}
          height={inner}
          className="object-contain opacity-60"
          style={{ width: inner, height: inner }}
        />
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
