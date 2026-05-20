import React from "react";
import Link from "next/link";
import Image from "next/image";
import { findPlatformSlugByName } from "@/lib/slugs";
import { PLATFORM_ICON_MAP } from "./constants";

// 좌측 로고 + 텍스트의 단정한 박스. 모노톤 컨테이너 + 로고만 컬러.
const BASE =
  "inline-flex items-center gap-1.5 rounded-md bg-zinc-900/60 ring-1 ring-zinc-700 px-2 py-1 text-[11px] sm:text-xs text-zinc-200 whitespace-nowrap";

function PlatformBadgeInner({
  platform,
  asLink = true,
}: {
  platform: string;
  /** false면 단순 뱃지(span)로만 렌더. 부모가 이미 Link로 감쌌을 때 nested anchor 방지. */
  asLink?: boolean;
}) {
  const slug = findPlatformSlugByName(platform);
  const iconSrc = PLATFORM_ICON_MAP[platform];
  const content = (
    <>
      {iconSrc && (
        <Image
          src={iconSrc}
          alt=""
          width={28}
          height={28}
          className="h-3.5 w-3.5 shrink-0 rounded-sm object-contain"
        />
      )}
      <span>{platform}</span>
    </>
  );

  if (!slug || !asLink) {
    return <span className={BASE}>{content}</span>;
  }
  return (
    <Link
      href={`/platform/${slug}`}
      className={`pointer-events-auto ${BASE} transition-colors hover:bg-zinc-800/80 hover:ring-zinc-500`}
    >
      {content}
    </Link>
  );
}

export const PlatformBadge = React.memo(PlatformBadgeInner);
