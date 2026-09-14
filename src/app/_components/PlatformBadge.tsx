import React from "react";
import Link from "next/link";
import Image from "next/image";
import { findPlatformSlugByName } from "@/lib/slugs";
import { PLATFORM_ICON_MAP } from "./constants";

/**
 * 플랫폼 뱃지 — 로고만 컬러, 컨테이너는 무채색.
 *
 * 🔴 여기에 색을 주지 않는 게 규칙이다. 한 카드 안에서 색을 갖는 건 상태 뱃지
 * (한국어 해설·LIVE) 하나뿐이어야 그게 눈에 들어온다. 원티드가 색을 아끼는 방식이다.
 */
const BASE =
  "inline-flex items-center gap-1.5 rounded-md border border-line-subtle bg-muted px-2 py-1 text-caption1 font-medium text-fg-secondary whitespace-nowrap";

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
      className={`pointer-events-auto ${BASE} transition-colors hover:border-line hover:text-fg`}
    >
      {content}
    </Link>
  );
}

export const PlatformBadge = React.memo(PlatformBadgeInner);
