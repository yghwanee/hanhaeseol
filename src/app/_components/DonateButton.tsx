"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 후원("응원하기") 버튼 — 결제 대행사·백엔드 없이 **송금 앱 딥링크**만으로 동작한다.
 * kicktalk.xyz 가 쓰는 구조를 이식했다(2026-07-30 라이브 코드 분석).
 *
 * 흐름: 금액 선택 → 토스 앱 열기 시도 → 실패하면 계좌(+선택적으로 카카오페이) 안내.
 *
 * 🔴 계좌 정보는 **환경변수로만** 받는다. 이 레포는 public 이라 하드코딩하면 계좌가
 * 깃 히스토리에 영구히 남는다. 다만 `NEXT_PUBLIC_*` 은 빌드시 번들에 인라인되므로
 * **브라우저 소스 보기로는 여전히 보인다** — 후원 계좌라 그건 의도된 것이고, 여기서
 * 막는 건 "깃 히스토리·GitHub 검색에 남는 것"뿐이다.
 *
 * 미설정이면 버튼 자체를 렌더하지 않는다(PushSubscribeButton 과 같은 패턴).
 */

const BANK = process.env.NEXT_PUBLIC_DONATE_BANK;
const ACCOUNT = process.env.NEXT_PUBLIC_DONATE_ACCOUNT;
const HOLDER = process.env.NEXT_PUBLIC_DONATE_HOLDER;

/**
 * 중계 테마 3단. 진입장벽을 낮게 잡았다(일 ~110명 트래픽엔 소액이 현실적).
 *
 * 카카오페이 송금 링크는 **만들 때 금액이 고정**된다(앱에서 금액을 정해 생성). 그래서
 * 티어마다 링크를 따로 받는다 — **환경변수 이름에 금액을 박아** 금액 불일치가 구조적으로
 * 불가능하게 했다. 셋 다 선택이고, 설정된 티어에서만 카카오페이 버튼이 뜬다.
 *
 * 🔴 `process.env.NEXT_PUBLIC_*` 는 **정적으로 쓴 자리만** 빌드시 값으로 치환된다.
 * `process.env["..." + amount]` 처럼 동적으로 조립하면 치환이 안 돼 항상 undefined 다.
 * 그래서 셋을 각각 리터럴로 적어야 한다(티어가 고정 목록이라 문제없다).
 */
const TIERS = [
  {
    label: "하이라이트",
    amount: 1900,
    emoji: "⚡",
    kakaopay: process.env.NEXT_PUBLIC_DONATE_KAKAOPAY_1900,
  },
  {
    label: "풀타임",
    amount: 4900,
    emoji: "🎧",
    kakaopay: process.env.NEXT_PUBLIC_DONATE_KAKAOPAY_4900,
  },
  {
    label: "시즌권",
    amount: 9900,
    emoji: "🏆",
    kakaopay: process.env.NEXT_PUBLIC_DONATE_KAKAOPAY_9900,
  },
] as const;

/** 토스 송금 딥링크. bank 는 한글이라 반드시 인코딩해야 한다. */
function tossLink(amount: number): string {
  return (
    "supertoss://send" +
    `?amount=${amount}` +
    `&bank=${encodeURIComponent(BANK ?? "")}` +
    `&accountNo=${encodeURIComponent(ACCOUNT ?? "")}` +
    "&origin=qr"
  );
}

const won = (n: number) => n.toLocaleString("ko-KR");

type Phase =
  | { kind: "pick" }
  | { kind: "opening" }
  | { kind: "fallback"; amount: number; kakaopay?: string };

export function DonateButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "pick" });
  const [copied, setCopied] = useState(false);
  // 딥링크 재진입 방지(연타로 앱 전환이 꼬이는 것 차단). kicktalk 도 같은 락을 쓴다.
  const busyRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);

  const close = useCallback(() => {
    setOpen(false);
    setPhase({ kind: "pick" });
    setCopied(false);
    busyRef.current = false;
    window.clearTimeout(timerRef.current);
  }, []);

  // Escape 로 닫기(프로젝트의 다른 모달과 동일한 접근성 처리).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const pick = (amount: number, kakaopay?: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPhase({ kind: "opening" });

    const startedAt = Date.now();
    window.location.href = tossLink(amount);

    // 앱이 열렸는지 판별하는 유일한 실마리가 **탭이 백그라운드로 갔는지**다.
    // 2.5초 안에 여전히 화면에 남아 있으면 토스 미설치로 보고 대체 수단을 안내한다.
    // (앱이 열렸다면 document.hidden 이 true 가 되거나 복귀까지 2.5초를 넘긴다.)
    timerRef.current = window.setTimeout(() => {
      busyRef.current = false;
      if (!document.hidden && Date.now() - startedAt < 2500) {
        setPhase({ kind: "fallback", amount, kakaopay });
      } else {
        setPhase({ kind: "pick" });
      }
    }, 2000);
  };

  const copyAccount = async () => {
    try {
      await navigator.clipboard.writeText(`${BANK} ${ACCOUNT}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  // 계좌가 설정되지 않은 환경(로컬·미설정 배포)에서는 버튼을 아예 노출하지 않는다.
  if (!BANK || !ACCOUNT) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="개발자 응원하기"
        className={`btn-caps-stripe inline-flex items-center justify-center gap-1 whitespace-nowrap px-3 py-1.5 text-[11px] font-medium sm:px-5 sm:py-2 sm:text-xs ${className}`}
      >
        <span aria-hidden>☕</span>
        <span>응원</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
          onClick={close}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="응원하기"
            className="w-full max-w-sm rounded-xl border border-zinc-700 bg-zinc-900 px-5 pb-6 pt-4 sm:px-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end">
              <button
                type="button"
                onClick={close}
                aria-label="응원하기 닫기"
                className="-mr-1 -mt-1 flex h-9 w-9 items-center justify-center rounded text-2xl leading-none text-zinc-500 hover:text-zinc-300"
              >
                &times;
              </button>
            </div>

            <p className="text-center text-base font-bold text-white">
              한해설을 응원해 주세요
            </p>
            <p className="mt-1.5 text-center text-xs leading-relaxed text-zinc-400">
              편성표는 계속 무료입니다. 보내주신 마음은 서버비와 개선에 씁니다.
            </p>

            {phase.kind === "pick" && (
              <div className="mt-5 space-y-2">
                {TIERS.map((t) => (
                  <button
                    key={t.amount}
                    type="button"
                    onClick={() => pick(t.amount, t.kakaopay)}
                    className="flex w-full items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/40 px-4 py-3 text-sm text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800"
                  >
                    <span className="flex items-center gap-2">
                      <span aria-hidden>{t.emoji}</span>
                      {t.label}
                    </span>
                    <b className="font-bold text-white">{won(t.amount)}원</b>
                  </button>
                ))}
                <p className="pt-1 text-center text-[11px] text-zinc-500">
                  금액을 누르면 토스 송금창이 열려요
                </p>
              </div>
            )}

            {phase.kind === "opening" && (
              <p className="mt-8 mb-6 text-center text-sm text-zinc-300">
                토스 앱 여는 중...
              </p>
            )}

            {phase.kind === "fallback" && (
              <div className="mt-5">
                <p className="text-center text-xs leading-relaxed text-zinc-400">
                  토스 앱이 열리지 않았어요. 아래로 보내주셔도 됩니다.
                </p>

                <div className="mt-3 rounded-lg border border-zinc-700 bg-zinc-800/40 px-4 py-3 text-center">
                  <p className="text-sm font-bold text-white">
                    {BANK} {ACCOUNT}
                  </p>
                  {HOLDER && (
                    <p className="mt-0.5 text-[11px] text-zinc-400">예금주 {HOLDER}</p>
                  )}
                  <p className="mt-1 text-[11px] text-zinc-500">
                    보내실 금액 {won(phase.amount)}원
                  </p>
                  <button
                    type="button"
                    onClick={copyAccount}
                    className="mt-2.5 rounded-lg border border-zinc-600 px-4 py-1.5 text-xs text-zinc-200 hover:border-zinc-400"
                  >
                    {copied ? "복사됨" : "계좌 복사"}
                  </button>
                </div>

                {/* 그 티어에 링크가 설정돼 있을 때만. 링크 자체가 그 금액으로 고정돼
                    발행된 것이므로 금액이 어긋날 수 없다. */}
                {phase.kakaopay && (
                  <a
                    href={phase.kakaopay}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 block rounded-lg border border-zinc-700 px-4 py-2.5 text-center text-xs text-zinc-200 hover:border-zinc-500"
                  >
                    카카오페이로 {won(phase.amount)}원 보내기
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => setPhase({ kind: "pick" })}
                  className="mt-3 w-full text-center text-[11px] text-zinc-500 hover:text-zinc-300"
                >
                  금액 다시 고르기
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
