"use client";

import Image from "next/image";
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
    label: "air",
    amount: 1900,
    emoji: "⚡",
    kakaopay: process.env.NEXT_PUBLIC_DONATE_KAKAOPAY_1900,
  },
  {
    label: "pro",
    amount: 4900,
    emoji: "🔥",
    kakaopay: process.env.NEXT_PUBLIC_DONATE_KAKAOPAY_4900,
  },
  {
    label: "max",
    amount: 9900,
    emoji: "👑",
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

/* 결제 앱 심볼. 외부 이미지 대신 인라인 SVG 로 둔다 — CSP·CDN 의존이 없고 용량도 0 이다.
   각 브랜드의 공개 심볼 형태만 단색으로 옮겼고, 브랜드 컬러는 타일 배경이 담당한다. */

/** 토스 심볼 — 흰 배경 위 파란 원 안의 흰 물결(간략화). 파란 타일 위에 흰색으로 얹는다. */
function TossMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-7 w-7" aria-hidden focusable="false">
      <circle cx="24" cy="24" r="22" fill="currentColor" opacity="0.18" />
      <path
        d="M13 30c4.2 0 6.2-2.4 8.4-5.2 2.3-2.9 4.1-5 7.1-5 2.8 0 4.6 1.9 4.6 4.6 0 3.2-2.3 5.6-5.7 5.6-1.7 0-3-.5-4.3-1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** 카카오 심볼 — 말풍선. 노란 타일 위에 검정으로 얹는다. */
function KakaoMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-7 w-7" aria-hidden focusable="false">
      <path
        d="M24 9C14.6 9 7 14.9 7 22.2c0 4.7 3.1 8.8 7.8 11.1l-1.9 7c-.2.6.5 1.1 1 .8l8.3-5.5c.6.1 1.2.1 1.8.1 9.4 0 17-5.9 17-13.5S33.4 9 24 9z"
        fill="currentColor"
      />
    </svg>
  );
}

/** 고른 금액은 `tier` 하나로 들고 다니고, 화면은 `step` 으로만 가른다.
 *  (금액·카카오링크를 단계마다 복사해 넘기면 단계 전환 때마다 어긋날 여지가 생긴다.) */
type Step = "pick" | "method" | "opening" | "fallback";

export function DonateButton({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("pick");
  const [tier, setTier] = useState<(typeof TIERS)[number] | null>(null);
  const [copied, setCopied] = useState(false);
  // 딥링크 재진입 방지(연타로 앱 전환이 꼬이는 것 차단).
  const busyRef = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);

  const close = useCallback(() => {
    setOpen(false);
    setStep("pick");
    setTier(null);
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
  const openApp = (url: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setStep("opening");

    const startedAt = Date.now();
    window.location.href = url;

    // 2.5초 안에 여전히 화면에 남아 있으면 미설치로 보고 계좌를 안내한다.
    // (앱이 열렸다면 document.hidden 이 true 가 되거나 복귀까지 2.5초를 넘긴다.)
    timerRef.current = window.setTimeout(() => {
      busyRef.current = false;
      setStep(!document.hidden && Date.now() - startedAt < 2500 ? "fallback" : "method");
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

  // 지역 const 로 받아 두면 아래 클로저 안에서도 좁혀진 타입이 유지된다
  // (`tier.kakaopay` 를 그대로 쓰면 state 필드 접근이라 non-null 단정이 필요해진다).
  const kakaopayUrl = tier?.kakaopay;

  return (
    <>
      {/* 띠배너 — 카카오페이 홈 광고 행과 같은 구조다:
          [아이콘 타일] + [작은 회색 윗줄 / 굵은 강조 아랫줄 `›`]. 닫기(X)는 두지 않는다.

          **모바일 치수는 카카오페이 캡처 실측을 그대로 옮겼다**(카드 높이 ~76px =
          아이콘 44 + 상하 16, 좌우 14, 윗줄 13px / 아랫줄 16px 볼드, radius 16).
          PC 는 같은 비율로 키운다(아이콘 56, 높이 96px). 종전엔 문구를 박스 정중앙에
          두고 CTA 를 absolute 로 띄우느라 좁은 폭에서 겹침을 폭별로 막아야 했는데,
          좌측 정렬 2줄 구조라 그 문제 자체가 사라졌다.

          배경은 카카오 노랑(#FEE500) 단색이다. 페이지가 거의 검정이라 이 한 덩어리만
          노랗게 두면 시선이 확실히 잡힌다(네온 테두리 `.border-glow` 는 제거 —
          노랑 위에서는 회전 그라데이션이 오히려 지저분해진다).
          글자는 노랑 위 대비 때문에 검정 계열로 간다(윗줄 옅은 검정, 아랫줄 진한 볼드). */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="개발자 응원하기"
        className={`flex w-full items-center gap-3 rounded-2xl bg-[#FEE500] px-3.5 py-4 text-left transition-transform hover:scale-[1.01] active:scale-[0.99] sm:gap-4 sm:px-5 sm:py-5 ${className}`}
      >
        {/* 선물 아이콘. 원본 500px PNG(164KB)를 표시 크기의 3배(168px) webp 로 미리
            줄여 뒀다(8KB). 이미 정확한 치수라 `unoptimized` 로 옵티마이저 왕복을 건너뛰고,
            첫 화면에 보이므로 `priority` 로 즉시 요청한다(채운 배너와 같은 처리).
            타일 배경은 두지 않는다 — 3D 아이콘이라 카드 위에 그대로 떠 있는 게 낫다. */}
        <Image
          src="/donate-icon.webp"
          alt=""
          width={56}
          height={56}
          unoptimized
          priority
          className="h-11 w-11 shrink-0 sm:h-14 sm:w-14"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-black/60 sm:text-[14px]">
            오늘만큼은 꼭 이겨야 한다면
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-[16px] font-bold text-[#191600] sm:text-[18px]">
            승리 기원 응원하기
            <span aria-hidden>›</span>
          </span>
        </span>
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
              편성표는 계속 무료입니다.
              <br />
              보내주신 마음은 서버비와 개선에 씁니다.
            </p>

            {/* 1단계 — 금액 */}
            {step === "pick" && (
              <div className="mt-5 space-y-2">
                {TIERS.map((t) => (
                  <button
                    key={t.amount}
                    type="button"
                    onClick={() => {
                      setTier(t);
                      setStep("method");
                    }}
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

            {/* 2단계 — 보낼 앱. tier 는 pick 을 거쳐야만 채워지므로 함께 좁힌다. */}
            {step === "method" && tier && (
              <div className="mt-5">
                <p className="text-center text-sm text-zinc-300">
                  <b className="text-white">{won(tier.amount)}원</b> · 어떤 앱으로 보낼까요?
                </p>

                <div className="mt-3 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => openApp(tossLink(tier.amount))}
                    className="flex h-24 w-28 flex-col items-center justify-center gap-1.5 rounded-xl bg-[#3182F6] text-white transition-transform hover:scale-[1.03]"
                  >
                    <TossMark />
                    <span className="text-xs font-semibold">토스</span>
                  </button>

                  {/* 링크가 설정된 티어에서만. 눌러도 안 되는 버튼은 보여주지 않는다. */}
                  {kakaopayUrl && (
                    <button
                      type="button"
                      onClick={() => openApp(kakaopayUrl)}
                      className="flex h-24 w-28 flex-col items-center justify-center gap-1.5 rounded-xl bg-[#FEE500] text-[#191600] transition-transform hover:scale-[1.03]"
                    >
                      <KakaoMark />
                      <span className="text-xs font-semibold">카카오페이</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setStep("fallback")}
                  className="mt-4 w-full text-center text-[11px] text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
                >
                  계좌번호로 직접 보내기
                </button>
              </div>
            )}

            {step === "opening" && (
              <p className="mt-8 mb-6 text-center text-sm text-zinc-300">앱 여는 중...</p>
            )}

            {/* 3단계 — 계좌 */}
            {step === "fallback" && tier && (
              <div className="mt-5">
                <div className="rounded-lg border border-zinc-700 bg-zinc-800/40 px-4 py-3 text-center">
                  <p className="text-sm font-bold text-white">
                    {BANK} {ACCOUNT}
                  </p>
                  {HOLDER && (
                    <p className="mt-0.5 text-[11px] text-zinc-400">예금주 {HOLDER}</p>
                  )}
                  <p className="mt-1 text-[11px] text-zinc-500">
                    보내실 금액 {won(tier.amount)}원
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
                  onClick={() => setStep("method")}
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
