"use client";

import React from "react";

/**
 * ⭐찜 버튼.
 *
 * 🔴 카드 전체에 매치 페이지로 가는 absolute Link 가 깔려 있다(z-0). 이 버튼은
 * `pointer-events-auto` + z-20 으로 그 위에 떠야 하고, 클릭이 카드 링크로 새지 않게
 * `preventDefault` + `stopPropagation` 을 둘 다 건다.
 */
function FollowStarInner({
  followed,
  onToggle,
  label,
  className = "",
}: {
  followed: boolean;
  onToggle: () => void;
  /** 스크린리더용 경기 이름. 예) "한화 vs 두산" */
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={followed}
      aria-label={followed ? `${label} 찜 해제` : `${label} 찜하기`}
      title={followed ? "찜 해제" : "찜하기"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      className={`pointer-events-auto relative z-20 -m-1 shrink-0 rounded-md p-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-400 ${
        followed
          ? "text-amber-400 hover:text-amber-300"
          : "text-zinc-600 hover:text-zinc-300"
      } ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4 sm:h-[18px] sm:w-[18px]"
        fill={followed ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={followed ? 0 : 1.8}
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 3.6l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.88l-5.2 2.73.99-5.79-4.21-4.1 5.82-.85L12 3.6z" />
      </svg>
    </button>
  );
}

export const FollowStar = React.memo(FollowStarInner);
