import React from "react";
import Image from "next/image";
import { PLATFORM_ICON_MAP } from "./constants";

function PlatformIconInner({ platformKey }: { platformKey: string }) {
  const iconSrc = PLATFORM_ICON_MAP[platformKey];

  if (iconSrc) {
    return (
      <Image
        src={iconSrc}
        alt={platformKey}
        width={36}
        height={36}
        className="rounded-md object-contain w-8 h-8"
      />
    );
  }

  if (platformKey === "전체") {
    return <span className="text-sm font-bold text-current">ALL</span>;
  }

  return (
    <svg width={19} height={19} viewBox="0 0 36 36" fill="none">
      <circle cx="18" cy="18" r="12" fill="#52525b" />
      <text x="18" y="22" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#ffffff">?</text>
    </svg>
  );
}

export const PlatformIcon = React.memo(PlatformIconInner);
