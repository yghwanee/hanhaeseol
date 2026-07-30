"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 후원("응원") 버튼 — 결제 대행사·백엔드 없이 **송금 앱 딥링크**만으로 동작한다.
 *
 * 흐름은 2단계다: **금액 고르기 → 보낼 앱 고르기(토스 / 카카오페이)**.
 * 예전엔 금액을 누르면 토스를 자동으로 열고 실패하면 카카오로 넘기는 연쇄 방식이었는데,
 * 사용자가 무엇이 열릴지 모르는 상태로 앱이 튀는 게 불친절해서 명시적 선택으로 바꿨다.
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
 * **토스는 금액을 딥링크 파라미터로 넘길 수 있어 계좌 하나로 3단이 다 되지만,
 * 카카오페이 링크는 `qr.kakaopay.com/<id>` 의 id 안에 금액이 박혀 발행된다** — 파라미터로
 * 바꿀 수 없어 금액마다 링크를 따로 만들어야 한다. 그래서 티어별로 환경변수를 받고,
 * **이름에 금액을 박아** 금액 불일치가 구조적으로 불가능하게 했다.
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
  /** 금액 고르기 */
  | { kind: "pick" }
  /** 앱 고르기 */
  | { kind: "method"; amount: number; kakaopay?: string }
  /** 딥링크 던지고 앱 전환 대기 */
  | { kind: "opening"; amount: number; kakaopay?: string }
  /** 앱이 안 열림 → 계좌 안내 */
  | { kind: "fallback"; amount: number; kakaopay?: string };

export function DonateButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "pick" });
  const [copied, setCopied] = useState(false);
  // 딥링크 재진입 방지(연타로 앱 전환이 꼬이는 것 차단).
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

  /** 앱 열기 시도. 열렸는지 판별하는 유일한 실마리가 **탭이 백그라운드로 갔는지**다. */
  const openApp = (url: string, amount: number, kakaopay?: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setPhase({ kind: "opening", amount, kakaopay });

    const startedAt = Date.now();
    window.location.href = url;

    // 2.5초 안에 여전히 화면에 남아 있으면 미설치로 보고 계좌를 안내한다.
    // (앱이 열렸다면 document.hidden 이 true 가 되거나 복귀까지 2.5초를 넘긴다.)
    timerRef.current = window.setTimeout(() => {
      busyRef.current = false;
      if (!document.hidden && Date.now() - startedAt < 2500) {
        setPhase({ kind: "fallback", amount, kakaopay });
      } else {
        setPhase({ kind: "method", amount, kakaopay });
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

  const amount = phase.kind === "pick" ? 0 : phase.amount;
  const kakaopay = phase.kind === "pick" ? undefined : phase.kakaopay;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="개발자 응원하기"
        /* 옆의 캡슐 버튼(btn-caps-stripe)들과 달리 글래스로 처리해 CTA 로 구분한다.
           `.liquid-glass` 는 radius 를 안 갖고 있어 rounded-full 을 같이 준다. */
        className={`liquid-glass inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-medium text-white transition-transform hover:scale-[1.04] active:scale-[0.97] [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] sm:px-5 sm:py-2 sm:text-xs ${className}`}
      >
        <span aria-hidden>💰</span>
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

            {/* 1단계 — 금액 */}
            {phase.kind === "pick" && (
              <div className="mt-5 space-y-2">
                {TIERS.map((t) => (
                  <button
                    key={t.amount}
                    type="button"
                    onClick={() =>
                      setPhase({ kind: "method", amount: t.amount, kakaopay: t.kakaopay })
                    }
                    className="flex w-full items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/40 px-4 py-3 text-sm text-zinc-200 transition-colors hover:border-zinc-500 hover:bg-zinc-800"
                  >
                    <span className="flex items-center gap-2">
                      <span aria-hidden>{t.emoji}</span>
                      {t.label}
                    </span>
                    <b className="font-bold text-white">{won(t.amount)}원</b>
                  </button>
                ))}
              </div>
            )}

            {/* 2단계 — 보낼 앱 */}
            {phase.kind === "method" && (
              <div className="mt-5">
                <p className="text-center text-sm text-zinc-300">
                  <b className="text-white">{won(amount)}원</b> · 어떤 앱으로 보낼까요?
                </p>

                <div className="mt-3 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => openApp(tossLink(amount), amount, kakaopay)}
                    className="flex h-24 w-28 flex-col items-center justify-center gap-2 rounded-xl bg-[#3182F6] text-white transition-transform hover:scale-[1.03]"
                  >
                    <span aria-hidden className="text-2xl font-black leading-none">
                      toss
                    </span>
                    <span className="text-[11px] font-medium opacity-90">토스</span>
                  </button>

                  {/* 링크가 설정된 티어에서만. 눌러도 안 되는 버튼은 보여주지 않는다. */}
                  {kakaopay && (
                    <button
                      type="button"
                      onClick={() => openApp(kakaopay, amount, kakaopay)}
                      className="flex h-24 w-28 flex-col items-center justify-center gap-2 rounded-xl bg-[#FEE500] text-[#191600] transition-transform hover:scale-[1.03]"
                    >
                      <span aria-hidden className="text-2xl font-black leading-none">
                        pay
                      </span>
                      <span className="text-[11px] font-medium opacity-80">카카오페이</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setPhase({ kind: "fallback", amount, kakaopay })}
                  className="mt-4 w-full text-center text-[11px] text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
                >
                  계좌번호로 직접 보내기
                </button>
                <button
                  type="button"
                  onClick={() => setPhase({ kind: "pick" })}
                  className="mt-2 w-full text-center text-[11px] text-zinc-500 hover:text-zinc-300"
                >
                  금액 다시 고르기
                </button>
              </div>
            )}

            {phase.kind === "opening" && (
              <p className="mt-8 mb-6 text-center text-sm text-zinc-300">앱 여는 중...</p>
            )}

            {/* 3단계(또는 직접 진입) — 계좌 */}
            {phase.kind === "fallback" && (
              <div className="mt-5">
                <div className="rounded-lg border border-zinc-700 bg-zinc-800/40 px-4 py-3 text-center">
                  <p className="text-sm font-bold text-white">
                    {BANK} {ACCOUNT}
                  </p>
                  {HOLDER && (
                    <p className="mt-0.5 text-[11px] text-zinc-400">예금주 {HOLDER}</p>
                  )}
                  <p className="mt-1 text-[11px] text-zinc-500">
                    보내실 금액 {won(amount)}원
                  </p>
                  <button
                    type="button"
                    onClick={copyAccount}
                    className="mt-2.5 rounded-lg border border-zinc-600 px-4 py-1.5 text-xs text-zinc-200 hover:border-zinc-400"
                  >
                    {copied ? "복사됨" : "계좌 복사"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setPhase({ kind: "method", amount, kakaopay })}
                  className="mt-3 w-full text-center text-[11px] text-zinc-500 hover:text-zinc-300"
                >
                  앱으로 보내기
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
