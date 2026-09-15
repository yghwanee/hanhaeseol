"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  currentSubscription,
  ensureSubscribed,
  pushConfigured,
  pushUnavailable,
  PUSH_SUB_EVENT,
} from "@/lib/push/client";
import { readFollows } from "@/lib/follows";
import { INTRO_DONE_EVENT, isIntroDone } from "./IntroAnimation";

/**
 * 첫 방문 안내 모달 — **찜하면 경기 알림이 온다**는 것 하나만 알린다.
 *
 * 🔴 왜 필요한가: 찜(⭐)과 알림이 한 동작으로 묶였는데(2026-09-15 작업121) 그걸 알 방법이
 * 화면에 없었다. 별은 경기 카드 안 작은 아이콘이고, 알림 설명은 푸터·「내 팀」 섹션에만
 * 있어서 편성 카드 수십 장을 지나야 나온다. 즉 **기능이 있는 줄 모르는 게 기본 상태**였다.
 *
 * 🔴 안 띄우는 경우가 중요하다. 이미 아는 사람에게 뜨면 방해일 뿐이다.
 *   · 이미 구독 중 — 켠 사람이다
 *   · 찜한 팀이 하나라도 있음 — 별을 아는 사람이다
 *   · 「오늘 하루 보지 않기」 유효기간 안
 *   · 이번 방문에서 이미 닫음(세션)
 *
 * 형태는 화니가 준 레퍼런스(쿠폰 모달)를 따른다 — 3D 아이콘이 카드 위로 걸치고, 닫기는
 * 카드 **밖** 오른쪽 위, 본문은 가운데 정렬, 큰 풀폭 CTA, 그 아래 아주 작은 각주.
 */

/**
 * 「오늘 하루 보지 않기」 기록. 값 = 다시 보여도 되는 시각(epoch ms).
 *
 * 🔴 **「닫기」는 아무것도 저장하지 않는다**(화니 지시, 2026-09-15). 그냥 닫은 사람에게는
 * 홈에 들어올 때마다 다시 보여 준다 — 안내를 안 본 사람에게 한 번 보여주고 끝내면
 * 기능이 있는 줄 모르는 상태로 돌아간다. 그만 보고 싶은 사람에게는 「오늘 하루 보지
 * 않기」가 있고, 그게 이 모달의 유일한 차단 장치다.
 */
const SNOOZE_KEY = "hhs.notice.notifyIntro.v1";

/**
 * 🔴 인트로가 끝나는 **그 순간** 올라온다(화니 지시, 2026-09-15). 종전에는 0.9초를 더
 * 기다렸는데, 라이브 실측에서 모달까지 PC 7.4초 · 폰 4.2초가 걸렸다 — 그 중 대부분이
 * 인트로다. 인트로 위에 겹쳐 띄우면 인트로를 못 보게 되므로, 줄일 수 있는 건 이 지연뿐이다.
 */
const DELAY_MS = 0;

/**
 * 켜진 뒤 「알림이 켜졌습니다 · 이제 별만 누르면 됩니다」를 붙잡아 두는 시간.
 *
 * 🔴 1.4초는 **너무 짧았다**("그거 너무 빨리 없어져" — 화니, 2026-09-15). 두 줄을 읽고
 * "다음엔 별을 누르면 된다"까지 머리에 남아야 하는 화면이라, 읽기 속도보다 넉넉해야 한다.
 * 이 시간이 끝나면 모달이 닫히며 가장 임박한 경기로 데려간다.
 */
const DONE_HOLD_MS = 3400;

/**
 * 🔴 **인트로가 끝난 뒤에 뜬다.** 홈에는 전체 화면 인트로(`z-[100]`)가 있고, 첫 방문
 * PC 는 타이핑까지 4초 넘게 걸린다. 고정 지연으로 띄우면 모달이 그 **뒤에 깔려** 아무도
 * 못 본다(실제로 첫 캡처에서 엠블럼 티커만 찍혔다). 사이드 배너가 같은 문제를 이미
 * 이 이벤트로 풀어 뒀다.
 *
 * 인트로가 **없는 페이지**(리그·매치 등)에서는 기다릴 게 없다 — 그때 이벤트만 믿으면
 * 모달이 영영 안 뜬다. 그래서 오버레이가 실제로 떠 있는지를 DOM 으로 확인한다.
 */
function afterIntro(): Promise<void> {
  return new Promise((resolve) => {
    if (isIntroDone() || !document.querySelector("[data-intro-overlay]")) {
      resolve();
      return;
    }
    window.addEventListener(INTRO_DONE_EVENT, () => resolve(), { once: true });
  });
}

function snoozedUntil(): number {
  try {
    const v = Number(localStorage.getItem(SNOOZE_KEY));
    return Number.isFinite(v) ? v : 0;
  } catch {
    return 0;
  }
}

/** 오늘 끝까지(KST 기준 다음 자정) 안 보이게 한다. "하루 뒤"가 아니라 "오늘 하루"다. */
function snoozeToday(): void {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kst.setUTCHours(24, 0, 0, 0);
  const until = kst.getTime() - 9 * 60 * 60 * 1000;
  try {
    localStorage.setItem(SNOOZE_KEY, String(until));
  } catch {
    /* 저장 불가 환경 — 다음 방문에 또 뜬다. 해가 없다 */
  }
}

type Phase = "hidden" | "open" | "done" | "failed";

/**
 * 켜지지 않은 이유. 🔴 **조용히 닫지 않는다.**
 *
 * 종전에는 거절·실패를 전부 `close()` 로 처리했다. 그러면 누른 사람 화면에서는 모달이
 * 아무 설명 없이 사라진다 — "알림 켜기 눌렀는데 아무 반응 없다"(화니, 2026-09-15).
 * 작업111 에서 같은 원칙을 이미 세웠다: 못 켜는 환경은 **이유와 다음 할 일을 말한다.**
 */
const FAIL_TEXT: Record<string, { title: string; body: string }> = {
  denied: {
    title: "브라우저가 알림을 막고 있어요",
    body: "주소창 왼쪽 자물쇠 → 알림 → 허용으로 바꾼 뒤 다시 눌러 주세요. 시크릿 창에서는 켤 수 없습니다.",
  },
  unavailable: {
    title: "이 창에서는 알림을 켤 수 없어요",
    body: "시크릿 창과 앱 안 브라우저는 알림을 막습니다. 일반 창(사파리·크롬)에서 켜 주세요.",
  },
  failed: {
    title: "지금은 알림을 켤 수 없어요",
    body: "시크릿 창과 앱 안 브라우저에서는 막혀 있습니다. 일반 창에서 다시 눌러 주세요. 별을 누르는 찜은 지금도 됩니다.",
  },
};

export function NotifyIntroModal() {
  const [phase, setPhase] = useState<Phase>("hidden");
  /** 이 브라우저에서 구독 자체가 안 되는 환경(아이폰 미설치·인앱 웹뷰)인가. */
  const [canPush, setCanPush] = useState(true);
  const [busy, setBusy] = useState(false);
  /** 켜기가 실패한 이유(`FAIL_TEXT` 의 키). */
  const [failReason, setFailReason] = useState<string>("failed");
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!pushConfigured()) return;
    if (Date.now() < snoozedUntil()) return;
    // 🔴 별을 이미 쓰는 사람에게는 안 띄운다. 찜은 로컬에 있으니 즉시 알 수 있다.
    if (readFollows().length > 0) return;

    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    void (async () => {
      await afterIntro();
      if (!alive) return;
      // 구독 중이면 이미 켠 사람이다.
      const sub = await currentSubscription();
      if (!alive || sub) return;
      timer = setTimeout(() => {
        if (!alive) return;
        setCanPush(!pushUnavailable());
        setPhase("open");
      }, DELAY_MS);
    })();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  /**
   * 닫기. `today` 면 자정까지 막고, 아니면 **아무것도 기록하지 않는다** — 다음에 홈에
   * 들어오면 또 뜬다(화니 지시).
   */
  const close = useCallback((today: boolean) => {
    if (today) snoozeToday();
    setPhase("hidden");
  }, []);

  useEffect(() => {
    if (phase === "hidden") return;
    // 🔴 CTA 가 아니라 **카드**에 포커스를 준다. CTA 에 주면 focus-visible 링이 그려져
    //    마우스로 열었을 때도 버튼이 눌린 것처럼 보인다(첫 캡처에서 실제로 그랬다).
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, close]);

  /**
   * 🔴 **권한만 받고 끝내지 않는다.** 찜한 팀이 없으면 `shouldReceive` 가 전부 걸러서
   * 실제로 오는 알림은 **0건**이다("알림 받기를 눌렀는데 무슨 알림이 오는 거냐" — 화니,
   * 2026-09-15). 그래서 켠 직후 **지금 시간 기준 가장 임박한 경기**로 화면을 옮기고 그
   * 카드와 별을 잠깐 강조한다. 별이 어디 있는지 글로 설명하는 것보다 그 자리로 데려가는
   * 쪽이 확실하다.
   *
   * 카드는 `data-game-start`(KST 오프셋 포함)를 달고 있다. 시작 전 경기가 없으면
   * (늦은 밤) 첫 카드로 간다 — 아무 데도 안 가는 것보다 낫다.
   */
  const focusNextGame = () => {
    const cards = Array.from(
      document.querySelectorAll<HTMLElement>("[data-game-start]"),
    );
    if (cards.length === 0) return;
    const now = Date.now();
    const upcoming = cards
      .map((el) => ({ el, at: Date.parse(el.dataset.gameStart ?? "") }))
      .filter((x) => Number.isFinite(x.at) && x.at > now)
      .sort((a, b) => a.at - b.at);
    const target = upcoming[0]?.el ?? cards[0];
    target.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "center",
    });
    // 카드와 그 안의 별에 잠깐 링을 준다. 클래스가 아니라 data 속성이라 Tailwind 빌드와
    // 무관하고, 지우면 흔적이 남지 않는다.
    target.setAttribute("data-star-hint", "");
    window.setTimeout(() => target.removeAttribute("data-star-hint"), 3200);
  };

  const turnOn = async () => {
    setBusy(true);
    const r = await ensureSubscribed(readFollows());
    setBusy(false);
    if (r === "subscribed" || r === "already") {
      window.dispatchEvent(new Event(PUSH_SUB_EVENT));
      // 🔴 켠 뒤 바로 닫지 않는다. **찜한 팀이 없으면 알림은 아직 안 온다** — 다음 할 일이
      //    무엇인지 이 자리에서 말해줘야 한다(그래서 문구가 바뀌고 잠깐 머문다).
      setPhase("done");
      snoozeToday();
      // 켜졌다는 걸 읽을 시간을 준 뒤 닫고 그 자리로 데려간다.
      setTimeout(() => {
        setPhase("hidden");
        focusNextGame();
      }, DONE_HOLD_MS);
      return;
    }
    // 🔴 조용히 닫지 않는다 — 누른 사람에게는 "아무 반응 없음" 으로 보인다.
    //    이유와 다음 할 일을 이 자리에서 말한다(작업111 과 같은 원칙).
    setFailReason(r);
    setPhase("failed");
  };

  if (phase === "hidden") return null;

  return (
    <div
      /* 🔴 딤이 다른 모달(40%)보다 진하다. 40% 에서는 뒤의 아시안게임 배너 문구가 그대로
         읽혀 시선이 안 모였다(캡처로 확인). 첫 방문에 한 번 뜨는 안내라 읽히는 쪽이 먼저다. */
      className="fixed inset-0 z-[60] flex items-center justify-center bg-inverse/65 px-5 animate-[introFadeIn_180ms_ease-out]"
      onClick={() => close(false)}
    >
      {/* 닫기 버튼이 카드 **밖** 위쪽에 서므로 카드와 함께 움직이는 기준 박스를 둔다. */}
      <div className="relative w-full max-w-[344px] sm:max-w-[468px]" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => close(false)}
          aria-label="안내 닫기"
          className="absolute -top-14 right-0 flex h-11 w-11 items-center justify-center rounded-full border border-line-subtle bg-muted text-fg-secondary transition-colors hover:text-fg-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg-strong"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="notify-intro-title"
          ref={cardRef}
          tabIndex={-1}
          style={{ outline: "none" }}
          className="relative rounded-[20px] outline-none focus:outline-none focus-visible:outline-none border border-line-subtle bg-elevated px-5 pb-5 pt-[58px] shadow-[var(--w-shadow-pop)]"
        >
          {/* 🔴 3D 종이 카드 윗변에 **걸쳐** 튀어나온다(레퍼런스의 형태). 트림 후 211×264 로
              미리 구운 webp 라 옵티마이저 왕복이 필요 없다(`unoptimized`). 높이 88px 표시에
              3배 해상도. 장식이라 `aria-hidden`. */}
          <Image
            src="/bell-3d.webp"
            alt=""
            width={211}
            height={264}
            unoptimized
            aria-hidden
            className="pointer-events-none absolute -top-[46px] left-1/2 h-[88px] w-[70px] -translate-x-1/2 select-none drop-shadow-[0_10px_20px_oklch(0_0_0/0.45)]"
          />

          {phase === "failed" ? (
            <>
              <h2
                id="notify-intro-title"
                className="text-balance text-center text-headline1 font-bold tracking-tight text-fg-strong"
              >
                {(FAIL_TEXT[failReason] ?? FAIL_TEXT.failed).title}
              </h2>
              <p className="mt-2 text-balance text-center text-label2 leading-relaxed text-fg-secondary">
                {(FAIL_TEXT[failReason] ?? FAIL_TEXT.failed).body}
              </p>
              {/* 알림을 못 켜도 **찜 자체는 된다** — 그쪽으로 데려간다. */}
              <button
                type="button"
                onClick={() => {
                  // 🔴 못 켜는 환경(시크릿·차단)은 몇 번 봐도 결과가 같다 — 오늘은 접는다.
                  close(true);
                  focusNextGame();
                }}
                className="mt-4 flex h-[52px] w-full items-center justify-center rounded-[12px] bg-brand text-body2 font-bold text-fg-onbrand transition-colors hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg-brand"
              >
                별 눌러보기
              </button>
            </>
          ) : phase === "done" ? (
            <>
              <p className="text-center text-label2 font-bold tracking-tight text-fg-brand-bright">
                알림이 켜졌습니다
              </p>
              <h2
                id="notify-intro-title"
                className="mt-1.5 text-center text-headline1 font-bold tracking-tight text-fg-strong"
              >
                이제 별만 누르면 됩니다
              </h2>
              <p className="mt-2 text-balance text-center text-label2 leading-relaxed text-fg-secondary">
                가장 먼저 열리는 경기로 옮겨드릴게요.
              </p>
              {/* 다 읽은 사람은 기다릴 이유가 없다 — 눌러서 바로 넘어갈 수 있게 둔다. */}
              <button
                type="button"
                onClick={() => {
                  setPhase("hidden");
                  focusNextGame();
                }}
                className="mt-4 flex h-[52px] w-full items-center justify-center rounded-[12px] bg-brand text-body2 font-bold text-fg-onbrand transition-colors hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg-brand"
              >
                경기 보러 가기
              </button>
            </>
          ) : (
            <>
              <h2
                id="notify-intro-title"
                className="text-center text-headline1 font-bold tracking-tight text-fg-strong"
              >
                찜한 팀 경기, 알림으로 받으세요
              </h2>
              <p className="mt-2 text-balance text-center text-label2 leading-relaxed text-fg-secondary">
                팀 이름 옆 별을 누르면 그 팀 경기만 알려드립니다.
              </p>

              <ul className="mt-4 grid grid-cols-1 gap-x-5 rounded-[14px] border border-line-subtle bg-canvas px-3.5 py-1 sm:grid-cols-2 sm:py-2.5">
                {NOTICES.map((n) => (
                  <li
                    key={n.title}
                    className="flex items-start gap-2.5 border-b border-line-subtle py-2.5 last:border-b-0 sm:border-b-0 sm:py-1.5"
                  >
                    <span className={`mt-px shrink-0 ${n.hot ? "text-fg-danger" : "text-fg-brand-bright"}`}>
                      {n.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-label1 font-semibold text-fg-strong">{n.title}</span>
                      <span className="mt-0.5 block text-caption1 leading-snug text-fg-secondary">{n.desc}</span>
                    </span>
                  </li>
                ))}
              </ul>

              {canPush ? (
                <button
                  type="button"
                  onClick={turnOn}
                  disabled={busy}
                  className="mt-4 flex h-[52px] w-full items-center justify-center rounded-[12px] bg-brand text-body2 font-bold text-fg-onbrand transition-colors hover:bg-brand-hover disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg-brand"
                >
                  {busy ? "켜는 중" : "알림 받기"}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => close(true)}
                  className="mt-4 flex h-[52px] w-full items-center justify-center rounded-[12px] bg-brand text-body2 font-bold text-fg-onbrand transition-colors hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg-brand"
                >
                  별 눌러보기
                </button>
              )}

              {/* 🔴 못 켜는 환경만 **이유를 말한다.** 유입의 대부분이 네이버 앱 안이고,
                  거기서는 버튼을 눌러도 구독이 안 걸린다(작업111 과 같은 판단).
                  켤 수 있는 환경에서는 각주를 두지 않는다 — 끄는 방법은 「내 팀」 자리에
                  토글로 항상 보이므로 여기서 또 말하면 군더더기다(화니 지시, 2026-09-15). */}
              {!canPush && (
                <p className="mt-3 text-center text-caption2 leading-relaxed text-fg-tertiary">
                  알림은 사파리·크롬으로 열거나, 아이폰은 홈 화면에 추가한 뒤 켤 수 있습니다.
                </p>
              )}
            </>
          )}

          <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-line-subtle pt-3">
            <button
              type="button"
              onClick={() => close(true)}
              className="relative text-caption1 text-fg-tertiary transition-colors after:absolute after:-inset-y-3 after:-inset-x-2 after:content-[''] hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fg-brand"
            >
              오늘 하루 보지 않기
            </button>
            <button
              type="button"
              onClick={() => close(false)}
              className="relative text-caption1 text-fg-secondary transition-colors after:absolute after:-inset-y-3 after:-inset-x-2 after:content-[''] hover:text-fg-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fg-brand"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 보내는 알림 네 가지. 문구는 실제 발송(`buildNotices`)과 같은 기준으로 적는다. */
const NOTICES: { title: string; desc: string; hot?: boolean; icon: React.ReactNode }[] = [
  {
    title: "경기 예고",
    desc: "내일 경기가 있으면 미리",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M3 11h18" />
      </svg>
    ),
  },
  {
    title: "경기 시작 1시간 전",
    desc: "어디서 보는지, 한국어 해설인지",
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3.5 2" />
      </svg>
    ),
  },
  {
    title: "득점 알림",
    desc: "점수가 바뀌면 바로",
    hot: true,
    // 축구공 — 원 + 중앙 오각형 + 이음선. 선으로만 그려 다른 아이콘과 무게를 맞춘다.
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.4l3.02 2.2-1.16 3.56h-3.72L9 9.6z" />
        <path d="M12 3.1v4.3M20.4 9.9l-4.54 1.7M17.1 19.6l-2.9-3.6M6.9 19.6l2.9-3.6M3.6 9.9l4.54 1.7" />
      </svg>
    ),
  },
  {
    title: "경기 종료",
    desc: "최종 점수를 한 줄로",
    // 휘슬 — 본체 원 + 왼쪽 관 + 위 고리.
    icon: (
      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round" aria-hidden>
        <circle cx="14.6" cy="13.6" r="5.6" />
        <path d="M9.2 11.4H3.9A1.4 1.4 0 012.5 10V8.5a1.4 1.4 0 011.4-1.4h9.9" />
        <path d="M13.8 7.1V4.9h2.3" />
      </svg>
    ),
  },
];
