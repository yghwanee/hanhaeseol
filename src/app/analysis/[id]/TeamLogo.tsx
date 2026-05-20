"use client";

import { useState } from "react";

export function TeamLogo({ name, src, size = 64 }: { name: string; src: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);

  // src 없거나 외부 이미지 로드 실패 시: 한해설 로고로 폴백 (initials placeholder 대신).
  // opacity-60으로 톤 다운해 실제 팀 로고와 시각적으로 구분.
  if (!src || failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src="/icon.png"
        alt={name}
        width={size}
        height={size}
        className="object-contain opacity-60"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
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
