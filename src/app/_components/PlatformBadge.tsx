import React from "react";
import Link from "next/link";
import { findPlatformSlugByName } from "@/lib/slugs";

const styles: Record<string, string> = {
  "SPOTV NOW": "bg-red-500/15 text-red-400 ring-red-500/30",
  SPOTV: "bg-red-500/15 text-red-400 ring-red-500/30",
  SPOTV2: "bg-orange-500/15 text-orange-400 ring-orange-500/30",
  쿠팡플레이: "bg-blue-500/15 text-blue-400 ring-blue-500/30",
  티빙: "bg-purple-500/15 text-purple-400 ring-purple-500/30",
  "tvN SPORTS": "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
  "KBS N SPORTS": "bg-sky-500/15 text-sky-400 ring-sky-500/30",
  "MBC SPORTS+": "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  "SBS Sports": "bg-indigo-500/15 text-indigo-400 ring-indigo-500/30",
  "Apple TV+": "bg-gray-500/15 text-gray-300 ring-gray-500/30",
};

function PlatformBadgeInner({ platform }: { platform: string }) {
  const slug = findPlatformSlugByName(platform);
  const style = styles[platform] ?? "bg-zinc-500/15 text-zinc-400 ring-zinc-500/30";

  if (!slug) {
    return (
      <span className={`inline-flex rounded-full px-2 sm:px-2.5 py-0.5 text-[11px] sm:text-xs font-semibold ring-1 ${style}`}>
        {platform}
      </span>
    );
  }
  return (
    <Link href={`/platform/${slug}`} className={`inline-flex items-center gap-1 rounded-full px-2 sm:px-2.5 py-0.5 text-[11px] sm:text-xs font-semibold ring-1 hover:brightness-125 transition-all ${style}`}>
      {platform}
      <span className="text-sm ml-0.5 opacity-60">›</span>
    </Link>
  );
}

export const PlatformBadge = React.memo(PlatformBadgeInner);
