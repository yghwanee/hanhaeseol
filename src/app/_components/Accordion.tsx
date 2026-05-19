"use client";

import { ReactNode, useId, useState } from "react";

/** 모션닷디브 react-accordion 스타일 — grid-template-rows 0fr↔1fr 트릭으로
 *  자동 높이 콘텐츠를 부드럽게 펼침/접음. */
export function AccordionItem({
  question,
  children,
  defaultOpen = false,
}: {
  question: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className="py-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-start justify-between gap-3 text-left text-sm font-medium text-zinc-100 outline-none focus:outline-none"
      >
        <span>{question}</span>
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`mt-1 h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-300 ease-out ${
            open ? "rotate-180" : ""
          }`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div
        id={id}
        className="grid transition-[grid-template-rows] duration-[320ms]"
        style={{
          gridTemplateRows: open ? "1fr" : "0fr",
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div className="overflow-hidden">
          <div
            className={`pt-2 pr-6 text-sm leading-relaxed text-zinc-400 whitespace-pre-line transition-opacity duration-300 ${
              open ? "opacity-100" : "opacity-0"
            }`}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
