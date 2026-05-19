"use client";

import { useEffect, useMemo, useState } from "react";

interface DatePickerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** YYYY-MM-DD */
  selectedDate: string;
  onSelect: (date: string) => void;
  maxDate?: string;
  minDate?: string;
}

const WEEK_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

const pad = (n: number) => String(n).padStart(2, "0");
const toIso = (y: number, m0: number, d: number) => `${y}-${pad(m0 + 1)}-${pad(d)}`;

interface Cell {
  day: number;
  iso: string;
  dow: number;
  inMonth: boolean;
  disabled: boolean;
}

export function DatePickerSheet({
  isOpen,
  onClose,
  selectedDate,
  onSelect,
  maxDate,
  minDate,
}: DatePickerSheetProps) {
  const initial = useMemo(() => {
    const [y, m, d] = selectedDate.split("-").map(Number);
    return { year: y, month0: m - 1, day: d };
  }, [selectedDate]);

  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month0);
  const [tempSelected, setTempSelected] = useState(selectedDate);

  // 열릴 때마다 현재 selectedDate 기준으로 view 동기화.
  useEffect(() => {
    if (!isOpen) return;
    setViewYear(initial.year);
    setViewMonth(initial.month0);
    setTempSelected(selectedDate);
  }, [isOpen, selectedDate, initial.year, initial.month0]);

  // ESC로 닫기.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // body scroll lock — 모달 아래 스크롤 차단.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // 6주 × 7일 = 42칸 그리드. 이전/다음 달 날짜로 빈칸을 채워 시각적 정렬 유지.
  const grid: Cell[] = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const firstDow = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate();
    const cells: Cell[] = [];

    const isDisabled = (iso: string) =>
      !!((maxDate && iso > maxDate) || (minDate && iso < minDate));

    // 이전 달 채우기
    for (let i = firstDow - 1; i >= 0; i--) {
      const day = prevMonthDays - i;
      const py = viewMonth === 0 ? viewYear - 1 : viewYear;
      const pm = (viewMonth - 1 + 12) % 12;
      const iso = toIso(py, pm, day);
      cells.push({
        day,
        iso,
        dow: new Date(iso + "T00:00:00").getDay(),
        inMonth: false,
        disabled: isDisabled(iso),
      });
    }

    // 이번 달
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = toIso(viewYear, viewMonth, d);
      cells.push({
        day: d,
        iso,
        dow: new Date(iso + "T00:00:00").getDay(),
        inMonth: true,
        disabled: isDisabled(iso),
      });
    }

    // 다음 달 채우기 (42칸까지)
    let extra = 1;
    while (cells.length < 42) {
      const ny = viewMonth === 11 ? viewYear + 1 : viewYear;
      const nm = (viewMonth + 1) % 12;
      const iso = toIso(ny, nm, extra);
      cells.push({
        day: extra,
        iso,
        dow: new Date(iso + "T00:00:00").getDay(),
        inMonth: false,
        disabled: isDisabled(iso),
      });
      extra++;
    }
    return cells;
  }, [viewYear, viewMonth, maxDate, minDate]);

  const canPrev = useMemo(() => {
    if (!minDate) return true;
    const lastOfPrev = (() => {
      const py = viewMonth === 0 ? viewYear - 1 : viewYear;
      const pm = (viewMonth - 1 + 12) % 12;
      const lastDay = new Date(py, pm + 1, 0).getDate();
      return toIso(py, pm, lastDay);
    })();
    return lastOfPrev >= minDate;
  }, [viewYear, viewMonth, minDate]);

  const canNext = useMemo(() => {
    if (!maxDate) return true;
    const ny = viewMonth === 11 ? viewYear + 1 : viewYear;
    const nm = (viewMonth + 1) % 12;
    return toIso(ny, nm, 1) <= maxDate;
  }, [viewYear, viewMonth, maxDate]);

  const prevMonth = () => {
    if (!canPrev) return;
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };
  const nextMonth = () => {
    if (!canNext) return;
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const confirmLabel = useMemo(() => {
    const parts = tempSelected.split("-").map(Number);
    const dow = WEEK_LABELS[new Date(tempSelected + "T00:00:00").getDay()];
    return `${parts[1]}월 ${parts[2]}일 (${dow}) 선택`;
  }, [tempSelected]);

  const canConfirm = useMemo(() => {
    if (maxDate && tempSelected > maxDate) return false;
    if (minDate && tempSelected < minDate) return false;
    return true;
  }, [tempSelected, maxDate, minDate]);

  return (
    <div
      className={`fixed inset-0 z-[200] ${isOpen ? "" : "pointer-events-none"}`}
      aria-hidden={!isOpen}
    >
      <div
        className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />
      <div className="pointer-events-none absolute inset-0 flex items-end justify-center sm:items-center">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="날짜 선택"
          onClick={(e) => e.stopPropagation()}
          className={`pointer-events-auto w-full max-w-sm border-t border-zinc-800 bg-zinc-900 rounded-t-2xl transition-all duration-300 sm:rounded-2xl sm:border ${
            isOpen
              ? "translate-y-0 opacity-100 sm:scale-100"
              : "translate-y-full opacity-0 sm:translate-y-0 sm:scale-95"
          }`}
        >
          {/* 모바일 핸들 */}
          <div className="flex justify-center pt-2.5 sm:hidden">
            <div className="h-1 w-10 rounded-full bg-zinc-700" />
          </div>

          {/* 헤더 */}
          <div className="relative flex items-center justify-center border-b border-zinc-800 px-4 py-3 sm:py-4">
            <h2 className="text-base font-bold text-white">날짜 선택</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="absolute right-3 flex h-8 w-8 items-center justify-center text-zinc-300 hover:text-white sm:right-4"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 월 네비 */}
          <div className="flex items-center justify-between px-6 pt-4 pb-3">
            <button
              type="button"
              onClick={prevMonth}
              disabled={!canPrev}
              aria-label="이전 달"
              className="flex h-8 w-8 items-center justify-center text-zinc-300 transition-colors hover:text-white disabled:cursor-not-allowed disabled:text-zinc-700"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-[15px] font-semibold text-zinc-100">
              {viewYear}년 {viewMonth + 1}월
            </span>
            <button
              type="button"
              onClick={nextMonth}
              disabled={!canNext}
              aria-label="다음 달"
              className="flex h-8 w-8 items-center justify-center text-zinc-300 transition-colors hover:text-white disabled:cursor-not-allowed disabled:text-zinc-700"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 px-3 pb-1">
            {WEEK_LABELS.map((d, i) => (
              <div
                key={d}
                className={`py-1.5 text-center text-[11px] font-medium ${
                  i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-zinc-500"
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          {/* 날짜 그리드 */}
          <div className="grid grid-cols-7 gap-y-1 px-3 pb-4">
            {grid.map((c, i) => {
              const isSelected = tempSelected === c.iso;
              const baseColor =
                c.dow === 0 ? "text-red-400" : c.dow === 6 ? "text-blue-400" : "text-zinc-200";
              return (
                <button
                  key={i}
                  type="button"
                  disabled={c.disabled}
                  onClick={() => setTempSelected(c.iso)}
                  aria-label={c.iso}
                  className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm transition-colors ${
                    isSelected
                      ? "bg-zinc-100 font-semibold text-zinc-900"
                      : c.disabled
                      ? "cursor-not-allowed text-zinc-700"
                      : c.inMonth
                      ? `${baseColor} hover:bg-zinc-800`
                      : "text-zinc-600 hover:bg-zinc-800/50"
                  }`}
                >
                  {c.day}
                </button>
              );
            })}
          </div>

          {/* 확정 버튼 — 사이트 시그니처 btn-caps-stripe 톤. */}
          <div className="px-4 pb-5 pt-1">
            <button
              type="button"
              disabled={!canConfirm}
              onClick={() => {
                onSelect(tempSelected);
                onClose();
              }}
              className={`inline-flex w-full items-center justify-center py-3 text-[14px] font-medium ${
                canConfirm ? "btn-caps-stripe" : "cursor-not-allowed bg-zinc-800 text-zinc-500"
              }`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
