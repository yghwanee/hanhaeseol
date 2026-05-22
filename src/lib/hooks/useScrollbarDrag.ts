"use client";

import React, { RefObject, useCallback, useRef } from "react";

// 가로 스크롤 컨테이너 아래에 두는 3px 인디케이터 바를 실제 동작하는 스크롤바로 만든다.
// thumb width 35% 가정 → 이동 가능 영역 = track 폭 × 65%.
// 클릭/드래그 X 를 thumb 중심으로 매핑해 scrollerRef.scrollLeft 를 직접 갱신.
// 기존 scroll 리스너가 thumb 위치(translateX)를 따라가므로 이 훅은 트랙만 관리.
export function useScrollbarDrag(scrollerRef: RefObject<HTMLElement | null>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const scrollFromBar = useCallback(
    (clientX: number) => {
      const list = scrollerRef.current;
      const track = trackRef.current;
      if (!list || !track) return;
      const max = list.scrollWidth - list.clientWidth;
      if (max <= 0) return;
      const rect = track.getBoundingClientRect();
      const thumbRatio = 0.35;
      const usable = rect.width * (1 - thumbRatio);
      if (usable <= 0) return;
      const half = (rect.width * thumbRatio) / 2;
      const offset = clientX - rect.left - half;
      const clamped = Math.max(0, Math.min(usable, offset));
      list.scrollLeft = (clamped / usable) * max;
    },
    [scrollerRef],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      dragging.current = true;
      scrollFromBar(e.clientX);
    },
    [scrollFromBar],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      scrollFromBar(e.clientX);
    },
    [scrollFromBar],
  );

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  return {
    trackRef,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}
