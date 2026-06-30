"use client";

import { useState, type ReactNode } from "react";

type Tab = "bracket" | "groups";

/**
 * /worldcup 의 [토너먼트] / [조별 순위] 탭.
 * 두 콘텐츠 모두 서버에서 렌더되어 DOM에 항상 존재(탭 전환은 표시만 토글) → 검색엔진이 둘 다 인식.
 */
export function WorldcupTabs({
  bracket,
  groups,
}: {
  bracket: ReactNode;
  groups: ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("bracket");

  const btn = (t: Tab, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === t}
      onClick={() => setTab(t)}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
        tab === t
          ? "bg-amber-400 text-amber-950"
          : "bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div role="tablist" className="mb-4 flex gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-1">
        {btn("bracket", "토너먼트")}
        {btn("groups", "조별 순위")}
      </div>
      <div className={tab === "bracket" ? "" : "hidden"}>{bracket}</div>
      <div className={tab === "groups" ? "" : "hidden"}>{groups}</div>
    </div>
  );
}
