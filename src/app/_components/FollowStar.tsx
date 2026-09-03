"use client";

import React from "react";

/**
 * ⭐찜 버튼.
 *
 * 🔴 카드 전체에 매치 페이지로 가는 absolute Link 가 깔려 있다(z-0). 이 버튼은
 * `pointer-events-auto` + z-20 으로 그 위에 떠야 하고, 클릭이 카드 링크로 새지 않게
 * `preventDefault` + `stopPropagation` 을 둘 다 건다.
 *
 * 🔴 **히트영역은 44px 이다(`after:inset-[-13px]`).** 종전엔 아이콘 18px + `-m-1 p-1`
 * = 약 26px 이었고, 바로 밑에 카드 전체 링크가 깔려 있어서 **손가락이 조금만 빗나가면
 * 별이 아니라 매치 페이지로 이동**했다. 화면이 바뀌니 사람은 찜한 줄 안다 — 다음 날
 * 홈에 와서 "찜이 반영이 안 됐다"가 된다(2026-09-04 iOS 사파리 사용자 지적).
 * 마우스로는 거의 안 나는 증상이라 PC 확인만으로는 못 잡는다. iOS 권장 최소치가 44px.
 *
 * 넓힌 영역이 팀명 쪽을 조금 덮지만, 팀명은 `pointer-events-none` 이라 그 아래 있는 건
 * 카드 링크뿐이다. 카드 어디를 눌러도 매치로 가므로 잃는 게 없다.
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
      className={`pointer-events-auto relative z-20 -m-1 shrink-0 touch-manipulation rounded-md p-1 transition-colors after:absolute after:inset-[-13px] after:content-[''] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-amber-400 ${
        followed
          ? "text-amber-400 hover:text-amber-300"
          : "text-zinc-600 hover:text-zinc-300"
      } ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        /* 16/18 → 18/20. 팀명(13.5~16px) 옆에서 너무 작아 눌러야 할 것으로 안 보였다
           (2026-09-03 사용자 지적). 버튼 히트영역은 -m-1 p-1 로 아이콘보다 크다. */
        className="h-[18px] w-[18px] sm:h-5 sm:w-5"
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
