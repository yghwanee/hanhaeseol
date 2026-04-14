"use client";

import { useState } from "react";

function initials(name: string): string {
  const clean = name.replace(/[.·]/g, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

function hueFromName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 360;
}

export function TeamLogo({ name, src, size = 64 }: { name: string; src: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    const hue = hueFromName(name);
    return (
      <div
        className="flex items-center justify-center rounded-full font-bold text-white"
        style={{
          width: size,
          height: size,
          background: `linear-gradient(135deg, hsl(${hue} 55% 45%), hsl(${(hue + 40) % 360} 55% 30%))`,
          fontSize: size * 0.36,
        }}
        aria-label={name}
      >
        {initials(name)}
      </div>
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
      className="object-contain"
      style={{ width: size, height: size }}
    />
  );
}
